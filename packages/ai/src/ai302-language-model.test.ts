import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import { AI302LanguageModel } from './ai302-language-model';
import type { AI302Config } from './ai302-config';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_PROMPT: LanguageModelV3Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

// Helper to convert ReadableStream to array
async function convertReadableStreamToArray<T>(
  stream: ReadableStream<T>,
): Promise<T[]> {
  const result: T[] = [];
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.push(value);
  }

  return result;
}

// Create OpenAI-format non-streaming response matching actual 302AI format
function createOpenAIResponse(options: {
  content?: string;
  reasoning_content?: string;
  finish_reason?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
      audio_tokens?: number;
    };
    completion_tokens_details?: {
      reasoning_tokens?: number;
      audio_tokens?: number;
      accepted_prediction_tokens?: number;
      rejected_prediction_tokens?: number;
    };
  };
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
}) {
  return {
    id: 'chatcmpl-Cg5q8ufZiX288LkA3zfZvlj1Nsk2s',
    object: 'chat.completion',
    created: 1764148260,
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant' as const,
          content: options.content ?? null,
          refusal: null,
          annotations: [],
          reasoning_content: options.reasoning_content,
          tool_calls: options.tool_calls,
        },
        logprobs: null,
        finish_reason: options.finish_reason ?? 'stop',
      },
    ],
    usage: options.usage ?? {
      prompt_tokens: 9,
      completion_tokens: 10,
      total_tokens: 19,
      prompt_tokens_details: {
        cached_tokens: 0,
        audio_tokens: 0,
      },
      completion_tokens_details: {
        reasoning_tokens: 0,
        audio_tokens: 0,
        accepted_prediction_tokens: 0,
        rejected_prediction_tokens: 0,
      },
    },
    system_fingerprint: 'fp_4a331a0222',
  };
}

// Create mock response
function createMockResponse(body: any, options: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status || 200,
    headers: { 'content-type': 'application/json' },
  });
}

// Create OpenAI-format SSE stream response matching actual 302AI format
function createOpenAIStreamResponse(chunks: Array<{
  content?: string;
  reasoning_content?: string;
  finish_reason?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
      audio_tokens?: number;
    };
    completion_tokens_details?: {
      reasoning_tokens?: number;
      audio_tokens?: number;
      accepted_prediction_tokens?: number;
      rejected_prediction_tokens?: number;
    };
  };
  tool_calls?: Array<{ index: number; id?: string; function: { name?: string; arguments?: string } }>;
}>) {
  const encoder = new TextEncoder();
  const streamChunks: string[] = [];

  for (const chunk of chunks) {
    const data = {
      id: 'chatcmpl-Cg5rEIiGJxLK5UX6qGFfTVD1uXUdW',
      object: 'chat.completion.chunk',
      created: 1764148328,
      model: 'gpt-4o',
      system_fingerprint: 'fp_4a331a0222',
      choices: [
        {
          index: 0,
          delta: {
            ...(chunk.content !== undefined && { content: chunk.content }),
            ...(chunk.reasoning_content !== undefined && { reasoning_content: chunk.reasoning_content }),
            ...(chunk.tool_calls !== undefined && { tool_calls: chunk.tool_calls }),
          },
          logprobs: null,
          finish_reason: chunk.finish_reason ?? null,
        },
      ],
      usage: chunk.usage ?? null,
    };
    streamChunks.push(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Add [DONE] marker
  streamChunks.push('data: [DONE]\n\n');

  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of streamChunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

let mockFetch: FetchFunction;
let capturedRequest: { url: string; init: RequestInit } | null;

const createTestModel = (config: Partial<AI302Config> = {}) => {
  return new AI302LanguageModel('gpt-4o', {
    provider: 'ai302.chat',
    url: ({ path }) => `https://api.302.ai${path}`,
    headers: () => ({
      Authorization: 'Bearer test-token',
    }),
    fetch: mockFetch,
    ...config,
  });
};

describe('AI302LanguageModel', () => {
  beforeEach(() => {
    capturedRequest = null;
    mockFetch = vi.fn((url, init) => {
      capturedRequest = { url: url.toString(), init };
      return Promise.resolve(
        createMockResponse(createOpenAIResponse({ content: 'Test response' })),
      );
    }) as FetchFunction;
  });

  describe('constructor', () => {
    it('should set basic properties', () => {
      const model = createTestModel();
      expect(model.modelId).toBe('gpt-4o');
      expect(model.provider).toBe('ai302.chat');
      expect(model.specificationVersion).toBe('v3');
      expect(model.defaultObjectGenerationMode).toBe('json');
    });

    it('should have supportedUrls property', () => {
      const model = createTestModel();
      expect(model.supportedUrls).toEqual({ '*/*': [/.*/] });
    });
  });

  describe('doGenerate', () => {
    it('should call fetch with correct URL', async () => {
      const model = createTestModel();

      await model.doGenerate({ prompt: TEST_PROMPT });

      expect(mockFetch).toHaveBeenCalled();
      expect(capturedRequest?.url).toBe('https://api.302.ai/v1/chat/completions');
    });

    it('should include Authorization header', async () => {
      const model = createTestModel();

      await model.doGenerate({ prompt: TEST_PROMPT });

      const headers = capturedRequest?.init.headers as Record<string, string>;
      expect(headers.authorization || headers.Authorization).toBe('Bearer test-token');
    });

    it('should include model in request body', async () => {
      const model = createTestModel();

      await model.doGenerate({ prompt: TEST_PROMPT });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.model).toBe('gpt-4o');
    });

    it('should extract text content from OpenAI response', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        createMockResponse(createOpenAIResponse({ content: 'Hello, World!' })),
      );

      const model = createTestModel();
      const result = await model.doGenerate({ prompt: TEST_PROMPT });

      expect(result.content).toEqual([{ type: 'text', text: 'Hello, World!' }]);
    });

    it('should extract reasoning content from OpenAI response', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        createMockResponse(createOpenAIResponse({
          content: 'The answer is 42.',
          reasoning_content: 'Let me think about this step by step...',
        })),
      );

      const model = createTestModel();
      const result = await model.doGenerate({ prompt: TEST_PROMPT });

      expect(result.content).toEqual([
        { type: 'reasoning', text: 'Let me think about this step by step...' },
        { type: 'text', text: 'The answer is 42.' },
      ]);
    });

    it('should extract finish reason', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        createMockResponse(createOpenAIResponse({
          content: 'Test',
          finish_reason: 'stop',
        })),
      );

      const model = createTestModel();
      const result = await model.doGenerate({ prompt: TEST_PROMPT });

      expect(result.finishReason).toBe('stop');
    });

    it('should extract usage information', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        createMockResponse(createOpenAIResponse({
          content: 'Test',
          usage: {
            prompt_tokens: 15,
            completion_tokens: 25,
            total_tokens: 40,
          },
        })),
      );

      const model = createTestModel();
      const result = await model.doGenerate({ prompt: TEST_PROMPT });

      expect(result.usage).toEqual({
        inputTokens: 15,
        outputTokens: 25,
        totalTokens: 40,
        reasoningTokens: undefined,
        cachedInputTokens: undefined,
      });
    });

    it('should extract response metadata', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        createMockResponse(createOpenAIResponse({ content: 'Test' })),
      );

      const model = createTestModel();
      const result = await model.doGenerate({ prompt: TEST_PROMPT });

      expect(result.response).toBeDefined();
      expect(result.response!.id).toBe('chatcmpl-Cg5q8ufZiX288LkA3zfZvlj1Nsk2s');
      expect(result.response!.modelId).toBe('gpt-4o');
      expect(result.response!.timestamp).toBeInstanceOf(Date);
    });

    it('should extract tool calls', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        createMockResponse(createOpenAIResponse({
          tool_calls: [
            {
              id: 'call_123',
              function: {
                name: 'get_weather',
                arguments: '{"location": "Tokyo"}',
              },
            },
          ],
          finish_reason: 'tool_calls',
        })),
      );

      const model = createTestModel();
      const result = await model.doGenerate({ prompt: TEST_PROMPT });

      expect(result.content).toContainEqual({
        type: 'tool-call',
        toolCallId: 'call_123',
        toolName: 'get_weather',
        input: '{"location": "Tokyo"}',
      });
      expect(result.finishReason).toBe('tool-calls');
    });

    it('should not include abortSignal in request body', async () => {
      const model = createTestModel();
      const controller = new AbortController();

      await model.doGenerate({
        prompt: TEST_PROMPT,
        abortSignal: controller.signal,
      });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body).not.toHaveProperty('abortSignal');
    });

    it('should pass abortSignal to fetch', async () => {
      const model = createTestModel();
      const controller = new AbortController();
      const signal = controller.signal;

      await model.doGenerate({
        prompt: TEST_PROMPT,
        abortSignal: signal,
      });

      expect(capturedRequest?.init.signal).toBe(signal);
    });

    it('should encode Uint8Array file parts to base64', async () => {
      const model = createTestModel();
      const fileBytes = new Uint8Array([1, 2, 3, 4]);
      const expectedBase64 = Buffer.from(fileBytes).toString('base64');

      const filePrompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this file:' },
            { type: 'file', data: fileBytes, mediaType: 'image/jpeg' },
          ],
        },
      ];

      await model.doGenerate({ prompt: filePrompt });

      const body = JSON.parse(capturedRequest?.init.body as string);
      // Now using OpenAI messages format with image_url
      const userMessage = body.messages[0];
      expect(userMessage.role).toBe('user');
      expect(userMessage.content[0].type).toBe('text');
      expect(userMessage.content[0].text).toBe('Describe this file:');
      expect(userMessage.content[1].type).toBe('image_url');
      expect(userMessage.content[1].image_url.url).toBe(`data:image/jpeg;base64,${expectedBase64}`);
    });

    it('should handle error responses', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        createMockResponse(
          { error: { message: 'Invalid request' } },
          { status: 400 },
        ),
      );

      const model = createTestModel();

      await expect(model.doGenerate({ prompt: TEST_PROMPT })).rejects.toThrow();
    });
  });

  describe('doStream', () => {
    beforeEach(() => {
      mockFetch = vi.fn((url, init) => {
        capturedRequest = { url: url.toString(), init };
        return Promise.resolve(
          createOpenAIStreamResponse([
            { content: 'Hello' },
            { content: ' World' },
            { finish_reason: 'stop' },
            { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
          ]),
        );
      }) as FetchFunction;
    });

    it('should call fetch with streaming request', async () => {
      const model = createTestModel();

      await model.doStream({ prompt: TEST_PROMPT });

      expect(mockFetch).toHaveBeenCalled();
      expect(capturedRequest).not.toBeNull();
      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.stream).toBe(true);
      expect(body.model).toBe('gpt-4o');
    });

    it('should stream text deltas', async () => {
      const model = createTestModel();
      const { stream } = await model.doStream({ prompt: TEST_PROMPT });

      const chunks = await convertReadableStreamToArray(stream);

      // Should have stream-start, response-metadata, text-start, text-deltas, text-end, finish
      expect(chunks.some((c: any) => c.type === 'stream-start')).toBe(true);
      expect(chunks.some((c: any) => c.type === 'response-metadata')).toBe(true);
      expect(chunks.some((c: any) => c.type === 'text-start')).toBe(true);
      expect(chunks.filter((c: any) => c.type === 'text-delta').length).toBeGreaterThan(0);
      expect(chunks.some((c: any) => c.type === 'text-end')).toBe(true);
      expect(chunks.some((c: any) => c.type === 'finish')).toBe(true);
    });

    it('should stream reasoning content', async () => {
      mockFetch = vi.fn((url, init) => {
        capturedRequest = { url: url.toString(), init };
        return Promise.resolve(
          createOpenAIStreamResponse([
            { reasoning_content: 'Let me think...' },
            { reasoning_content: ' step by step.' },
            { content: 'The answer is 42.' },
            { finish_reason: 'stop' },
            { usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } },
          ]),
        );
      }) as FetchFunction;

      const model = createTestModel();
      const { stream } = await model.doStream({ prompt: TEST_PROMPT });

      const chunks = await convertReadableStreamToArray(stream);

      // Should have reasoning events
      expect(chunks.some((c: any) => c.type === 'reasoning-start')).toBe(true);
      expect(chunks.filter((c: any) => c.type === 'reasoning-delta').length).toBeGreaterThan(0);
      expect(chunks.some((c: any) => c.type === 'reasoning-end')).toBe(true);

      // Should also have text events
      expect(chunks.some((c: any) => c.type === 'text-start')).toBe(true);
      expect(chunks.some((c: any) => c.type === 'text-delta')).toBe(true);
      expect(chunks.some((c: any) => c.type === 'text-end')).toBe(true);
    });

    it('should include usage in finish event', async () => {
      const model = createTestModel();
      const { stream } = await model.doStream({ prompt: TEST_PROMPT });

      const chunks = await convertReadableStreamToArray(stream);
      const finishChunk = chunks.find((c: any) => c.type === 'finish') as any;

      expect(finishChunk).toBeDefined();
      expect(finishChunk.finishReason).toBe('stop');
      expect(finishChunk.usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        reasoningTokens: undefined,
        cachedInputTokens: undefined,
      });
    });

    it('should pass abortSignal to fetch for streaming', async () => {
      const model = createTestModel();
      const controller = new AbortController();
      const signal = controller.signal;

      await model.doStream({
        prompt: TEST_PROMPT,
        abortSignal: signal,
      });

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.init.signal).toBe(signal);
    });

    it('should encode file parts in streaming requests', async () => {
      const model = createTestModel();
      const fileBytes = new Uint8Array([1, 2, 3, 4]);
      const expectedBase64 = Buffer.from(fileBytes).toString('base64');

      const filePrompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            { type: 'file', data: fileBytes, mediaType: 'image/jpeg' },
          ],
        },
      ];

      await model.doStream({ prompt: filePrompt });

      expect(capturedRequest).not.toBeNull();
      const body = JSON.parse(capturedRequest!.init.body as string);
      // Now using OpenAI messages format with image_url
      const userMessage = body.messages[0];
      expect(userMessage.role).toBe('user');
      expect(userMessage.content[0].type).toBe('image_url');
      expect(userMessage.content[0].image_url.url).toBe(`data:image/jpeg;base64,${expectedBase64}`);
    });

    it('should stream tool calls', async () => {
      mockFetch = vi.fn((url, init) => {
        capturedRequest = { url: url.toString(), init };
        return Promise.resolve(
          createOpenAIStreamResponse([
            { tool_calls: [{ index: 0, id: 'call_123', function: { name: 'get_weather', arguments: '' } }] },
            { tool_calls: [{ index: 0, function: { arguments: '{"loc' } }] },
            { tool_calls: [{ index: 0, function: { arguments: 'ation":"Tokyo"}' } }] },
            { finish_reason: 'tool_calls' },
            { usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 } },
          ]),
        );
      }) as FetchFunction;

      const model = createTestModel();
      const { stream } = await model.doStream({ prompt: TEST_PROMPT });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks.some((c: any) => c.type === 'tool-input-start')).toBe(true);
      expect(chunks.filter((c: any) => c.type === 'tool-input-delta').length).toBeGreaterThan(0);
      expect(chunks.some((c: any) => c.type === 'tool-input-end')).toBe(true);
      expect(chunks.some((c: any) => c.type === 'tool-call')).toBe(true);

      const toolCallChunk = chunks.find((c: any) => c.type === 'tool-call') as any;
      expect(toolCallChunk.toolCallId).toBe('call_123');
      expect(toolCallChunk.toolName).toBe('get_weather');
      expect(toolCallChunk.input).toBe('{"location":"Tokyo"}');
    });
  });
});
