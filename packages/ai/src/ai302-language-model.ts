import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
  SharedV3Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertToBase64,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  generateId,
  postJsonToApi,
  resolve,
  type ParseResult,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';
import type { AI302Config } from './ai302-config';
import type { AI302ChatModelId, AI302ChatSettings } from './ai302-chat-settings';

// OpenAI Chat Message types
type OpenAIChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | OpenAIUserContentPart[] }
  | {
      role: 'assistant';
      content: string | null;
      /**
       * Reasoning content for thinking mode (e.g., DeepSeek).
       * This field must be passed back to the API during tool call continuations
       * within the same turn to maintain the model's chain of thought.
       */
      reasoning_content?: string | null;
      tool_calls?: OpenAIToolCall[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

type OpenAIUserContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenAIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description: string | undefined;
    parameters: unknown;
  };
};

// Convert AI SDK prompt to OpenAI messages format
function convertToOpenAIChatMessages(
  prompt: LanguageModelV3Prompt,
): OpenAIChatMessage[] {
  const messages: OpenAIChatMessage[] = [];

  for (const { role, content } of prompt) {
    switch (role) {
      case 'system': {
        messages.push({ role: 'system', content });
        break;
      }

      case 'user': {
        if (content.length === 1 && content[0].type === 'text') {
          messages.push({ role: 'user', content: content[0].text });
          break;
        }

        messages.push({
          role: 'user',
          content: content.map(part => {
            switch (part.type) {
              case 'text': {
                return { type: 'text' as const, text: part.text };
              }
              case 'file': {
                if (part.mediaType.startsWith('image/')) {
                  const mediaType =
                    part.mediaType === 'image/*' ? 'image/jpeg' : part.mediaType;
                  return {
                    type: 'image_url' as const,
                    image_url: {
                      url:
                        part.data instanceof URL
                          ? part.data.toString()
                          : `data:${mediaType};base64,${convertToBase64(part.data)}`,
                    },
                  };
                }
                throw new Error(`Unsupported file media type: ${part.mediaType}`);
              }
              default:
                throw new Error(`Unsupported content part type: ${(part as any).type}`);
            }
          }),
        });
        break;
      }

      case 'assistant': {
        let text = '';
        let reasoningText = '';
        const toolCalls: OpenAIToolCall[] = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              text += part.text;
              break;
            }
            case 'reasoning': {
              // Collect reasoning content for thinking mode
              reasoningText += part.text;
              break;
            }
            case 'tool-call': {
              toolCalls.push({
                id: part.toolCallId,
                type: 'function',
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.input),
                },
              });
              break;
            }
          }
        }

        messages.push({
          role: 'assistant',
          content: text || null,
          // Include reasoning_content for thinking mode tool call continuations
          reasoning_content: reasoningText || undefined,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        });
        break;
      }

      case 'tool': {
        for (const toolResponse of content) {
          const output = toolResponse.output;
          let contentValue: string;

          switch (output.type) {
            case 'text':
            case 'error-text':
              contentValue = output.value;
              break;
            case 'execution-denied':
              contentValue = output.reason ?? 'Tool execution denied.';
              break;
            case 'content':
            case 'json':
            case 'error-json':
              contentValue = JSON.stringify(output.value);
              break;
            default:
              contentValue = '';
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolResponse.toolCallId,
            content: contentValue,
          });
        }
        break;
      }

      default: {
        throw new Error(`Unsupported role: ${role}`);
      }
    }
  }

  return messages;
}

// Prepare tools for OpenAI format
function prepareTools({
  tools,
  toolChoice,
}: {
  tools: LanguageModelV3CallOptions['tools'];
  toolChoice?: LanguageModelV3CallOptions['toolChoice'];
}): {
  tools: OpenAITool[] | undefined;
  toolChoice:
    | { type: 'function'; function: { name: string } }
    | 'auto'
    | 'none'
    | 'required'
    | undefined;
  toolWarnings: SharedV3Warning[];
} {
  const toolWarnings: SharedV3Warning[] = [];

  // When tools array is empty, change to undefined
  if (!tools?.length) {
    return { tools: undefined, toolChoice: undefined, toolWarnings };
  }

  const openaiTools: OpenAITool[] = [];

  for (const tool of tools) {
    if (tool.type === 'provider') {
      toolWarnings.push({ type: 'unsupported', feature: `provider tool: ${tool.name}` });
    } else {
      openaiTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      });
    }
  }

  if (toolChoice == null) {
    return { tools: openaiTools, toolChoice: undefined, toolWarnings };
  }

  const type = toolChoice.type;

  switch (type) {
    case 'auto':
    case 'none':
    case 'required':
      return { tools: openaiTools, toolChoice: type, toolWarnings };
    case 'tool':
      return {
        tools: openaiTools,
        toolChoice: {
          type: 'function',
          function: { name: toolChoice.toolName },
        },
        toolWarnings,
      };
    default:
      return { tools: openaiTools, toolChoice: undefined, toolWarnings };
  }
}

// Helper: Map OpenAI finish_reason to LanguageModelV3FinishReason
function mapOpenAIFinishReason(
  finishReason: string | null | undefined,
): LanguageModelV3FinishReason {
  switch (finishReason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content-filter';
    case 'function_call':
    case 'tool_calls':
      return 'tool-calls';
    default:
      return 'unknown';
  }
}

// Helper: Extract response metadata from OpenAI response
function getResponseMetadata({
  id,
  model,
  created,
}: {
  id?: string | undefined | null;
  created?: number | undefined | null;
  model?: string | undefined | null;
}) {
  return {
    id: id ?? undefined,
    modelId: model ?? undefined,
    timestamp: created != null ? new Date(created * 1000) : undefined,
  };
}

// Token usage schema - matches 302AI/OpenAI response format
const openaiTokenUsageSchema = z
  .object({
    prompt_tokens: z.number().nullish(),
    completion_tokens: z.number().nullish(),
    total_tokens: z.number().nullish(),
    prompt_tokens_details: z
      .object({
        cached_tokens: z.number().nullish(),
        audio_tokens: z.number().nullish(),
      })
      .nullish(),
    completion_tokens_details: z
      .object({
        reasoning_tokens: z.number().nullish(),
        audio_tokens: z.number().nullish(),
        accepted_prediction_tokens: z.number().nullish(),
        rejected_prediction_tokens: z.number().nullish(),
      })
      .nullish(),
    // Additional fields that may appear in streaming usage chunks
    input_tokens: z.number().nullish(),
    output_tokens: z.number().nullish(),
  })
  .nullish();

// Non-streaming response schema - matches 302AI/OpenAI response format
const openaiChatResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  system_fingerprint: z.string().nullish(),
  choices: z.array(
    z.object({
      index: z.number().nullish(),
      message: z.object({
        role: z.literal('assistant').nullish(),
        content: z.string().nullish(),
        refusal: z.string().nullish(),
        annotations: z.array(z.unknown()).nullish(),
        reasoning_content: z.string().nullish(),
        reasoning: z.string().nullish(),
        tool_calls: z
          .array(
            z.object({
              id: z.string().nullish(),
              function: z.object({
                name: z.string(),
                arguments: z.string(),
              }),
            }),
          )
          .nullish(),
      }),
      logprobs: z.unknown().nullish(),
      finish_reason: z.string().nullish(),
    }),
  ),
  usage: openaiTokenUsageSchema,
});

// Streaming chunk schema - matches 302AI/OpenAI streaming format
const openaiChatChunkSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  system_fingerprint: z.string().nullish(),
  choices: z.array(
    z.object({
      index: z.number().nullish(),
      delta: z
        .object({
          role: z.enum(['assistant']).nullish(),
          content: z.string().nullish(),
          refusal: z.string().nullish(),
          reasoning_content: z.string().nullish(),
          reasoning: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                index: z.number(),
                id: z.string().nullish(),
                function: z.object({
                  name: z.string().nullish(),
                  arguments: z.string().nullish(),
                }),
              }),
            )
            .nullish(),
        })
        .nullish(),
      logprobs: z.unknown().nullish(),
      finish_reason: z.string().nullish(),
    }),
  ),
  usage: openaiTokenUsageSchema,
});

export class AI302LanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3';
  readonly defaultObjectGenerationMode = 'json';
  readonly supportedUrls = { '*/*': [/.*/] };

  constructor(
    readonly modelId: AI302ChatModelId,
    private readonly settings: AI302ChatSettings,
    private readonly config: AI302Config,
  ) {}

  get provider(): string {
    return this.config.provider;
  }

  private async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
    toolChoice,
    tools,
  }: Parameters<LanguageModelV3['doGenerate']>[0]) {
    const warnings: SharedV3Warning[] = [];

    // topK is not supported by OpenAI
    if (topK != null) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }

    // Prepare tools
    const {
      tools: openaiTools,
      toolChoice: openaiToolChoice,
      toolWarnings,
    } = prepareTools({ tools, toolChoice });

    return {
      args: {
        // model id
        model: this.modelId,

        // standardized settings (mapped to OpenAI parameter names)
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stop: stopSequences,
        seed,

        // response format
        response_format:
          responseFormat?.type === 'json'
            ? responseFormat.schema != null
              ? {
                  type: 'json_schema',
                  json_schema: {
                    schema: responseFormat.schema,
                    name: responseFormat.name ?? 'response',
                    description: responseFormat.description,
                  },
                }
              : { type: 'json_object' }
            : undefined,

        // messages (converted from AI SDK prompt format)
        messages: convertToOpenAIChatMessages(prompt),

        // tools
        tools: openaiTools,
        tool_choice: openaiToolChoice,

        // thinking mode for DeepSeek models
        ...(this.settings.thinking && { thinking: this.settings.thinking }),
      },
      warnings: [...warnings, ...toolWarnings],
    };
  }

  async doGenerate(
    options: Parameters<LanguageModelV3['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV3['doGenerate']>>> {
    const { args, warnings } = await this.getArgs(options);
    const { abortSignal } = options;

    const resolvedHeaders = await resolve(this.config.headers());

    const body = args;

    const {
      responseHeaders,
      value: responseBody,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: this.config.url({ modelId: this.modelId, path: '/v1/chat/completions' }),
      headers: combineHeaders(resolvedHeaders, options.headers),
      body,
      successfulResponseHandler: createJsonResponseHandler(openaiChatResponseSchema),
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: z.any(),
        errorToMessage: data => data?.error?.message ?? JSON.stringify(data),
      }),
      ...(abortSignal && { abortSignal }),
      fetch: this.config.fetch,
    });

    const choice = responseBody.choices[0];
    const content: Array<LanguageModelV3Content> = [];

    // Reasoning content (before text)
    const reasoning = choice.message.reasoning_content ?? choice.message.reasoning;
    if (reasoning != null && reasoning.length > 0) {
      content.push({ type: 'reasoning', text: reasoning });
    }

    // Text content
    const text = choice.message.content;
    if (text != null && text.length > 0) {
      content.push({ type: 'text', text });
    }

    // Tool calls
    if (choice.message.tool_calls != null) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id ?? generateId(),
          toolName: toolCall.function.name,
          input: toolCall.function.arguments,
        });
      }
    }

    return {
      content,
      finishReason: mapOpenAIFinishReason(choice.finish_reason),
      usage: {
        inputTokens: {
          total: responseBody.usage?.prompt_tokens ?? undefined,
          noCache: undefined,
          cacheRead: responseBody.usage?.prompt_tokens_details?.cached_tokens ?? undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: responseBody.usage?.completion_tokens ?? undefined,
          text: undefined,
          reasoning: responseBody.usage?.completion_tokens_details?.reasoning_tokens ?? undefined,
        },
      },
      request: { body: JSON.stringify(body) },
      response: {
        ...getResponseMetadata(responseBody),
        headers: responseHeaders,
        body: rawResponse,
      },
      warnings,
    };
  }

  async doStream(
    options: Parameters<LanguageModelV3['doStream']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV3['doStream']>>> {
    const { args, warnings } = await this.getArgs(options);
    const { abortSignal } = options;

    const resolvedHeaders = await resolve(this.config.headers());

    const body = {
      ...args,
      stream: true,
    };

    const { value: response, responseHeaders } = await postJsonToApi({
      url: this.config.url({ modelId: this.modelId, path: '/v1/chat/completions' }),
      headers: combineHeaders(resolvedHeaders, options.headers),
      body,
      successfulResponseHandler: createEventSourceResponseHandler(openaiChatChunkSchema),
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: z.any(),
        errorToMessage: data => data?.error?.message ?? JSON.stringify(data),
      }),
      ...(abortSignal && { abortSignal }),
      fetch: this.config.fetch,
    });

    // Track state for streaming
    const toolCalls: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
      hasFinished: boolean;
    }> = [];

    let finishReason: LanguageModelV3FinishReason = 'unknown';
    const usage: {
      promptTokens: number | undefined;
      completionTokens: number | undefined;
      totalTokens: number | undefined;
      reasoningTokens: number | undefined;
      cachedTokens: number | undefined;
    } = {
      promptTokens: undefined,
      completionTokens: undefined,
      totalTokens: undefined,
      reasoningTokens: undefined,
      cachedTokens: undefined,
    };

    let isFirstChunk = true;
    let isActiveReasoning = false;
    let isActiveText = false;

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof openaiChatChunkSchema>>,
          LanguageModelV3StreamPart
        >({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });
          },

          transform(chunk, controller) {
            // Handle failed chunk parsing
            if (!chunk.success) {
              finishReason = 'error';
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

            // Emit response metadata on first chunk
            if (isFirstChunk) {
              isFirstChunk = false;
              controller.enqueue({
                type: 'response-metadata',
                ...getResponseMetadata(value),
              });
            }

            // Process usage info (usually comes in final chunk)
            if (value.usage != null) {
              usage.promptTokens = value.usage.prompt_tokens ?? undefined;
              usage.completionTokens = value.usage.completion_tokens ?? undefined;
              usage.totalTokens = value.usage.total_tokens ?? undefined;
              if (value.usage.completion_tokens_details?.reasoning_tokens != null) {
                usage.reasoningTokens = value.usage.completion_tokens_details.reasoning_tokens;
              }
              if (value.usage.prompt_tokens_details?.cached_tokens != null) {
                usage.cachedTokens = value.usage.prompt_tokens_details.cached_tokens;
              }
            }

            const choice = value.choices[0];

            // Check for finish reason
            if (choice?.finish_reason != null) {
              finishReason = mapOpenAIFinishReason(choice.finish_reason);
            }

            if (choice?.delta == null) {
              return;
            }

            const delta = choice.delta;

            // Process reasoning content (before text)
            const reasoningContent = delta.reasoning_content ?? delta.reasoning;
            if (reasoningContent) {
              if (!isActiveReasoning) {
                controller.enqueue({ type: 'reasoning-start', id: 'reasoning-0' });
                isActiveReasoning = true;
              }
              controller.enqueue({
                type: 'reasoning-delta',
                id: 'reasoning-0',
                delta: reasoningContent,
              });
            }

            // Process text content
            if (delta.content) {
              if (!isActiveText) {
                controller.enqueue({ type: 'text-start', id: 'txt-0' });
                isActiveText = true;
              }
              controller.enqueue({
                type: 'text-delta',
                id: 'txt-0',
                delta: delta.content,
              });
            }

            // Process tool calls
            if (delta.tool_calls != null) {
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index;

                if (toolCalls[index] == null) {
                  // New tool call
                  const toolCallId = toolCallDelta.id ?? generateId();
                  const toolName = toolCallDelta.function?.name ?? '';

                  controller.enqueue({
                    type: 'tool-input-start',
                    id: toolCallId,
                    toolName,
                  });

                  toolCalls[index] = {
                    id: toolCallId,
                    type: 'function',
                    function: {
                      name: toolName,
                      arguments: toolCallDelta.function?.arguments ?? '',
                    },
                    hasFinished: false,
                  };

                  if (toolCalls[index].function.arguments.length > 0) {
                    controller.enqueue({
                      type: 'tool-input-delta',
                      id: toolCallId,
                      delta: toolCalls[index].function.arguments,
                    });
                  }
                } else {
                  // Existing tool call - append arguments
                  const toolCall = toolCalls[index];
                  if (!toolCall.hasFinished && toolCallDelta.function?.arguments) {
                    toolCall.function.arguments += toolCallDelta.function.arguments;
                    controller.enqueue({
                      type: 'tool-input-delta',
                      id: toolCall.id,
                      delta: toolCallDelta.function.arguments,
                    });
                  }
                }
              }
            }
          },

          flush(controller) {
            // End reasoning if active
            if (isActiveReasoning) {
              controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' });
            }

            // End text if active
            if (isActiveText) {
              controller.enqueue({ type: 'text-end', id: 'txt-0' });
            }

            // Finish tool calls
            for (const toolCall of toolCalls.filter(tc => !tc.hasFinished)) {
              controller.enqueue({ type: 'tool-input-end', id: toolCall.id });
              controller.enqueue({
                type: 'tool-call',
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                input: toolCall.function.arguments,
              });
            }

            // Emit finish event
            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: {
                inputTokens: {
                  total: usage.promptTokens,
                  noCache: undefined,
                  cacheRead: usage.cachedTokens,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: usage.completionTokens,
                  text: undefined,
                  reasoning: usage.reasoningTokens,
                },
              },
            });
          },
        }),
      ),
      request: { body: JSON.stringify(body) },
      response: { headers: responseHeaders },
    };
  }

}
