import {
  TranscriptionModelV3,
  TranscriptionModelV3CallOptions,
  SharedV3Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertBase64ToUint8Array,
  createJsonResponseHandler,
  mediaTypeToExtension,
  parseProviderOptions,
  postFormDataToApi,
  createJsonErrorResponseHandler,
  resolve,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';
import type { AI302Config } from './ai302-config';
import {
  ai302TranscriptionVerboseResponseSchema,
  ai302TranscriptionJsonResponseSchema,
  ai302TranscriptionDiarizedResponseSchema,
  type AI302TranscriptionVerboseResponse,
  type AI302TranscriptionJsonResponse,
  type AI302TranscriptionDiarizedResponse,
} from './ai302-transcription-api';
import {
  AI302TranscriptionModelId,
  ai302TranscriptionProviderOptionsSchema,
  AI302TranscriptionProviderOptions,
  AI302TranscriptionResponseFormat,
} from './ai302-transcription-settings';

export type AI302TranscriptionCallOptions = Omit<
  TranscriptionModelV3CallOptions,
  'providerOptions'
> & {
  providerOptions?: {
    ai302?: AI302TranscriptionProviderOptions;
  };
};

interface AI302TranscriptionModelConfig extends AI302Config {
  _internal?: {
    currentDate?: () => Date;
  };
}

// https://platform.openai.com/docs/guides/speech-to-text#supported-languages
const languageMap: Record<string, string> = {
  afrikaans: 'af',
  arabic: 'ar',
  armenian: 'hy',
  azerbaijani: 'az',
  belarusian: 'be',
  bosnian: 'bs',
  bulgarian: 'bg',
  catalan: 'ca',
  chinese: 'zh',
  croatian: 'hr',
  czech: 'cs',
  danish: 'da',
  dutch: 'nl',
  english: 'en',
  estonian: 'et',
  finnish: 'fi',
  french: 'fr',
  galician: 'gl',
  german: 'de',
  greek: 'el',
  hebrew: 'he',
  hindi: 'hi',
  hungarian: 'hu',
  icelandic: 'is',
  indonesian: 'id',
  italian: 'it',
  japanese: 'ja',
  kannada: 'kn',
  kazakh: 'kk',
  korean: 'ko',
  latvian: 'lv',
  lithuanian: 'lt',
  macedonian: 'mk',
  malay: 'ms',
  marathi: 'mr',
  maori: 'mi',
  nepali: 'ne',
  norwegian: 'no',
  persian: 'fa',
  polish: 'pl',
  portuguese: 'pt',
  romanian: 'ro',
  russian: 'ru',
  serbian: 'sr',
  slovak: 'sk',
  slovenian: 'sl',
  spanish: 'es',
  swahili: 'sw',
  swedish: 'sv',
  tagalog: 'tl',
  tamil: 'ta',
  thai: 'th',
  turkish: 'tr',
  ukrainian: 'uk',
  urdu: 'ur',
  vietnamese: 'vi',
  welsh: 'cy',
};

/**
 * Models that only support json format (not verbose_json)
 */
const jsonOnlyModels = ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe'];

/**
 * Models that support diarized_json format
 */
const diarizedModels = ['gpt-4o-transcribe-diarize'];

/**
 * Get the default response format for a model
 */
function getDefaultResponseFormat(
  modelId: string,
): AI302TranscriptionResponseFormat {
  if (jsonOnlyModels.includes(modelId)) {
    return 'json';
  }
  return 'verbose_json';
}

export class AI302TranscriptionModel implements TranscriptionModelV3 {
  readonly specificationVersion = 'v3';

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: AI302TranscriptionModelId,
    private readonly config: AI302TranscriptionModelConfig,
  ) {}

  private async getArgs({
    audio,
    mediaType,
    providerOptions,
  }: AI302TranscriptionCallOptions) {
    const warnings: SharedV3Warning[] = [];

    // Parse provider options
    const ai302Options = await parseProviderOptions({
      provider: 'ai302',
      providerOptions,
      schema: ai302TranscriptionProviderOptionsSchema,
    });

    // Create form data with base fields
    const formData = new FormData();
    const audioData =
      audio instanceof Uint8Array ? audio : convertBase64ToUint8Array(audio);
    const blob = new Blob([audioData as BlobPart]);

    formData.append('model', this.modelId);
    const fileExtension = mediaTypeToExtension(mediaType);
    formData.append(
      'file',
      new File([blob], 'audio', { type: mediaType }),
      `audio.${fileExtension}`,
    );

    // Determine response format
    const responseFormat =
      ai302Options?.responseFormat ?? getDefaultResponseFormat(this.modelId);

    // Add provider-specific options
    const transcriptionOptions: Record<string, unknown> = {
      response_format: responseFormat,
    };

    if (ai302Options) {
      if (ai302Options.language) {
        transcriptionOptions.language = ai302Options.language;
      }
      if (ai302Options.prompt) {
        transcriptionOptions.prompt = ai302Options.prompt;
      }
      if (ai302Options.temperature != null) {
        transcriptionOptions.temperature = ai302Options.temperature;
      }
      if (ai302Options.timestampGranularities) {
        transcriptionOptions.timestamp_granularities =
          ai302Options.timestampGranularities;
      }
      if (ai302Options.include) {
        transcriptionOptions.include = ai302Options.include;
      }
    }

    for (const [key, value] of Object.entries(transcriptionOptions)) {
      if (value != null) {
        if (Array.isArray(value)) {
          for (const item of value) {
            formData.append(`${key}[]`, String(item));
          }
        } else {
          formData.append(key, String(value));
        }
      }
    }

    return {
      formData,
      warnings,
      responseFormat,
    };
  }

  async doGenerate(
    options: AI302TranscriptionCallOptions,
  ): Promise<Awaited<ReturnType<TranscriptionModelV3['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { formData, warnings, responseFormat } = await this.getArgs(options);

    const resolvedHeaders = await resolve(this.config.headers());
    const headers = combineHeaders(resolvedHeaders, options.headers);

    // Handle text/srt/vtt formats that return raw text
    if (['text', 'srt', 'vtt'].includes(responseFormat)) {
      return this.handleTextResponse(
        formData,
        headers,
        options,
        currentDate,
        warnings,
      );
    }

    // Handle JSON-based formats based on response format
    if (responseFormat === 'diarized_json') {
      return this.handleDiarizedResponse(
        formData,
        headers,
        options,
        currentDate,
        warnings,
      );
    }

    if (responseFormat === 'json') {
      return this.handleJsonResponse(
        formData,
        headers,
        options,
        currentDate,
        warnings,
      );
    }

    // Default to verbose_json
    return this.handleVerboseResponse(
      formData,
      headers,
      options,
      currentDate,
      warnings,
    );
  }

  /**
   * Handle verbose_json response format
   */
  private async handleVerboseResponse(
    formData: FormData,
    headers: Record<string, string | undefined>,
    options: AI302TranscriptionCallOptions,
    currentDate: Date,
    warnings: SharedV3Warning[],
  ): Promise<Awaited<ReturnType<TranscriptionModelV3['doGenerate']>>> {
    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse,
    } = await postFormDataToApi({
      url: this.config.url({
        path: '/302/v1/audio/transcriptions',
        modelId: this.modelId,
      }),
      headers,
      formData,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: z.any(),
        errorToMessage: data => data?.error?.message ?? JSON.stringify(data),
      }),
      successfulResponseHandler:
        createJsonResponseHandler<AI302TranscriptionVerboseResponse>(
          ai302TranscriptionVerboseResponseSchema,
        ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    // Extract language
    const language =
      response.language != null && response.language in languageMap
        ? languageMap[response.language]
        : undefined;

    // Extract segments
    let segments: Array<{
      text: string;
      startSecond: number;
      endSecond: number;
    }> = [];

    if (response.segments) {
      segments = response.segments.map(segment => ({
        text: segment.text,
        startSecond: segment.start,
        endSecond: segment.end,
      }));
    } else if (response.words) {
      segments = response.words.map(word => ({
        text: word.word,
        startSecond: word.start,
        endSecond: word.end,
      }));
    }

    return {
      text: response.text,
      segments,
      language,
      durationInSeconds: response.duration ?? undefined,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawResponse,
      },
    };
  }

  /**
   * Handle json response format
   */
  private async handleJsonResponse(
    formData: FormData,
    headers: Record<string, string | undefined>,
    options: AI302TranscriptionCallOptions,
    currentDate: Date,
    warnings: SharedV3Warning[],
  ): Promise<Awaited<ReturnType<TranscriptionModelV3['doGenerate']>>> {
    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse,
    } = await postFormDataToApi({
      url: this.config.url({
        path: '/302/v1/audio/transcriptions',
        modelId: this.modelId,
      }),
      headers,
      formData,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: z.any(),
        errorToMessage: data => data?.error?.message ?? JSON.stringify(data),
      }),
      successfulResponseHandler:
        createJsonResponseHandler<AI302TranscriptionJsonResponse>(
          ai302TranscriptionJsonResponseSchema,
        ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    return {
      text: response.text,
      segments: [],
      language: undefined,
      durationInSeconds: undefined,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawResponse,
      },
    };
  }

  /**
   * Handle diarized_json response format (speaker diarization)
   */
  private async handleDiarizedResponse(
    formData: FormData,
    headers: Record<string, string | undefined>,
    options: AI302TranscriptionCallOptions,
    currentDate: Date,
    warnings: SharedV3Warning[],
  ): Promise<Awaited<ReturnType<TranscriptionModelV3['doGenerate']>>> {
    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse,
    } = await postFormDataToApi({
      url: this.config.url({
        path: '/302/v1/audio/transcriptions',
        modelId: this.modelId,
      }),
      headers,
      formData,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: z.any(),
        errorToMessage: data => data?.error?.message ?? JSON.stringify(data),
      }),
      successfulResponseHandler:
        createJsonResponseHandler<AI302TranscriptionDiarizedResponse>(
          ai302TranscriptionDiarizedResponseSchema,
        ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    // Extract segments with speaker info
    const segments: Array<{
      text: string;
      startSecond: number;
      endSecond: number;
    }> = response.segments
      ? response.segments.map(segment => ({
          text: `[${segment.speaker}] ${segment.text}`,
          startSecond: segment.start,
          endSecond: segment.end,
        }))
      : [];

    return {
      text: response.text,
      segments,
      language: undefined,
      durationInSeconds: undefined,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawResponse,
      },
    };
  }

  /**
   * Handle text/srt/vtt response formats that return raw text
   */
  private async handleTextResponse(
    formData: FormData,
    headers: Record<string, string | undefined>,
    options: AI302TranscriptionCallOptions,
    currentDate: Date,
    warnings: SharedV3Warning[],
  ): Promise<Awaited<ReturnType<TranscriptionModelV3['doGenerate']>>> {
    const fetchFn = this.config.fetch ?? fetch;

    const response = await fetchFn(
      this.config.url({
        path: '/302/v1/audio/transcriptions',
        modelId: this.modelId,
      }),
      {
        method: 'POST',
        headers: headers as Record<string, string>,
        body: formData,
        signal: options.abortSignal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Transcription failed: ${response.status} - ${errorText}`,
      );
    }

    const text = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      text,
      segments: [],
      language: undefined,
      durationInSeconds: undefined,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: text,
      },
    };
  }
}
