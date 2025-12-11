import type { SpeechModelV3, SharedV3Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  resolve,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';
import type { AI302Config } from './ai302-config';
import {
  ai302SpeechProviderOptionsSchema,
  type AI302SpeechModelId,
  type AI302SpeechProviderOptions,
  type AI302TTSRequestBody,
} from './ai302-speech-settings';

// Response schemas
const ttsResponseSchema = z.object({
  task_id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  created_at: z.string().optional(),
  completed_at: z.string().optional(),
  audio_url: z.string().optional(),
  raw_response: z
    .object({
      audio: z
        .object({
          url: z.string(),
          content_type: z.string().optional(),
          file_size: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

const taskStatusSchema = z.object({
  task_id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  audio_url: z.string().optional(),
  completed_at: z.string().optional(),
  execution_time: z.string().optional(),
});

interface AI302SpeechModelConfig extends AI302Config {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class AI302SpeechModel implements SpeechModelV3 {
  readonly specificationVersion = 'v3';

  constructor(
    readonly modelId: AI302SpeechModelId,
    private readonly config: AI302SpeechModelConfig,
  ) {}

  get provider(): string {
    return this.config.provider;
  }

  /**
   * Parse modelId to extract provider and voice
   * Format: "provider/voice" or "provider/model/voice"
   */
  private parseModelId(): { provider: string; voice: string; model?: string } {
    const parts = this.modelId.split('/');
    if (parts.length === 2) {
      return { provider: parts[0], voice: parts[1] };
    } else if (parts.length >= 3) {
      return { provider: parts[0], model: parts[1], voice: parts.slice(2).join('/') };
    }
    throw new Error(`Invalid speech model ID format: ${this.modelId}. Expected "provider/voice" or "provider/model/voice"`);
  }

  private async getArgs({
    text,
    voice,
    outputFormat,
    speed,
    providerOptions,
  }: Parameters<SpeechModelV3['doGenerate']>[0]) {
    const warnings: SharedV3Warning[] = [];

    // Parse provider options
    const ai302Options = await parseProviderOptions({
      provider: 'ai302',
      providerOptions,
      schema: ai302SpeechProviderOptionsSchema,
    });

    // Parse model ID
    const { provider, voice: defaultVoice, model } = this.parseModelId();

    // Build request body
    const requestBody: AI302TTSRequestBody = {
      text,
      provider,
      voice: voice ?? defaultVoice,
    };

    // Add optional parameters
    if (model || ai302Options?.model) {
      requestBody.model = ai302Options?.model ?? model;
    }
    if (speed != null) {
      requestBody.speed = speed;
    }
    if (ai302Options?.volume != null) {
      requestBody.volume = ai302Options.volume;
    }
    if (ai302Options?.emotion) {
      requestBody.emotion = ai302Options.emotion;
    }
    if (outputFormat) {
      requestBody.output_format = outputFormat;
    }
    if (ai302Options?.timeout) {
      requestBody.timeout = ai302Options.timeout;
    }

    // Build query params for async mode
    const queryParams: Record<string, string> = {};
    if (ai302Options?.runAsync) {
      queryParams.run_async = 'true';
    }
    if (ai302Options?.webhook) {
      queryParams.webhook = ai302Options.webhook;
    }

    return {
      requestBody,
      queryParams,
      warnings,
      ai302Options: ai302Options ?? {},
    };
  }

  /**
   * Poll for async task completion
   */
  private async pollForResult(
    taskId: string,
    options: {
      pollInterval: number;
      maxAttempts: number;
      abortSignal?: AbortSignal;
      headers: Record<string, string | undefined>;
    },
  ): Promise<string> {
    const { pollInterval, maxAttempts, abortSignal, headers } = options;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (abortSignal?.aborted) {
        throw new Error('Request aborted');
      }

      // Wait before polling (except first attempt)
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      const { value: status } = await postJsonToApi({
        url: this.config.url({
          modelId: this.modelId,
          path: `/302/v2/audio/fetch/${taskId}`,
        }),
        headers,
        body: {},
        successfulResponseHandler: createJsonResponseHandler(taskStatusSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: data => data?.error?.message ?? JSON.stringify(data),
        }),
        abortSignal,
        fetch: this.config.fetch,
      });

      if (status.status === 'completed' && status.audio_url) {
        return status.audio_url;
      }

      if (status.status === 'failed') {
        throw new Error(`TTS task failed: ${taskId}`);
      }
    }

    throw new Error(`TTS task timed out after ${maxAttempts} attempts: ${taskId}`);
  }

  /**
   * Download audio from URL and return as Uint8Array
   */
  private async downloadAudio(
    audioUrl: string,
    abortSignal?: AbortSignal,
  ): Promise<Uint8Array> {
    const fetchFn = this.config.fetch ?? fetch;
    const response = await fetchFn(audioUrl, {
      method: 'GET',
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async doGenerate(
    options: Parameters<SpeechModelV3['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<SpeechModelV3['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { requestBody, queryParams, warnings, ai302Options } =
      await this.getArgs(options);

    const resolvedHeaders = await resolve(this.config.headers());
    const headers = combineHeaders(resolvedHeaders, options.headers);

    // Build URL with query params
    const baseUrl = this.config.url({
      modelId: this.modelId,
      path: '/302/v2/audio/tts',
    });
    const queryString = new URLSearchParams(queryParams).toString();
    const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

    // Make TTS request
    const {
      value: responseBody,
      responseHeaders,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url,
      headers,
      body: requestBody,
      successfulResponseHandler: createJsonResponseHandler(ttsResponseSchema),
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: z.any(),
        errorToMessage: data => data?.error?.message ?? JSON.stringify(data),
      }),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let audioUrl: string;

    // Handle async vs sync response
    if (responseBody.status === 'pending') {
      // Async mode: poll for completion
      const pollInterval = ai302Options.pollInterval ?? 2000;
      const maxAttempts = ai302Options.maxPollAttempts ?? 90;

      audioUrl = await this.pollForResult(responseBody.task_id, {
        pollInterval,
        maxAttempts,
        abortSignal: options.abortSignal,
        headers,
      });
    } else if (responseBody.status === 'completed' && responseBody.audio_url) {
      // Sync mode: audio URL is in response
      audioUrl = responseBody.audio_url;
    } else if (responseBody.status === 'failed') {
      throw new Error(`TTS generation failed: ${responseBody.task_id}`);
    } else {
      throw new Error(`Unexpected TTS response status: ${responseBody.status}`);
    }

    // Download audio
    const audio = await this.downloadAudio(audioUrl, options.abortSignal);

    return {
      audio,
      warnings,
      request: {
        body: JSON.stringify(requestBody),
      },
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawResponse,
      },
    };
  }
}

