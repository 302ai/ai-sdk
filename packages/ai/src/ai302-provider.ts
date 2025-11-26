import {
  EmbeddingModelV3,
  ImageModelV3,
  LanguageModelV3,
  ProviderV3,
  SpeechModelV3,
} from '@ai-sdk/provider';
import { AI302ImageModelId, AI302ImageSettings } from './ai302-image-settings';
import {
  FetchFunction,
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
} from '@ai-sdk/provider-utils';
import { AI302ImageModel } from './ai302-image-model';
import { AI302Config } from './ai302-config';
import {
  OpenAICompatibleEmbeddingModel,
  ProviderErrorStructure,
} from '@ai-sdk/openai-compatible';
import { AI302ChatSettings, AI302ChatModelId } from './ai302-chat-settings';
import { AI302EmbeddingModelId } from './ai302-embedding-settings';
import { z } from 'zod';
import { AI302EmbeddingSettings } from './ai302-embedding-settings';
import { AI302LanguageModel } from './ai302-language-model';
import { AI302SpeechModel } from './ai302-speech-model';
import { AI302SpeechModelId } from './ai302-speech-settings';
import { VERSION } from './version';

export type AI302ErrorData = z.infer<typeof ai302ErrorSchema>;

const ai302ErrorSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
});

const ai302ErrorStructure: ProviderErrorStructure<AI302ErrorData> = {
  errorSchema: ai302ErrorSchema,
  errorToMessage: error => error.error.message,
};

export interface AI302ProviderSettings {
  /**
  AI302 API key. Default value is taken from the `AI302_API_KEY`
  environment variable.
  */
  apiKey?: string;
  /**
  Base URL for the API calls.
  */
  baseURL?: string;
  /**
  Custom headers to include in the requests.
  */
  headers?: Record<string, string>;
  /**
  Custom fetch implementation. You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.
  */
  fetch?: FetchFunction;
}

export interface AI302Provider extends ProviderV3 {
  /**
    Creates a model for text generation.
    */
  (modelId: AI302ChatModelId, settings?: AI302ChatSettings): LanguageModelV3;

  /**
Creates a chat model for text generation.
*/
  languageModel(
    modelId: AI302ChatModelId,
    settings?: AI302ChatSettings,
  ): LanguageModelV3;

  /**
Creates a chat model for text generation.
*/
  chatModel(
    modelId: AI302ChatModelId,
    settings?: AI302ChatSettings,
  ): LanguageModelV3;

  /**
  Creates a text embedding model for text generation.
  */
  textEmbeddingModel(
    modelId: AI302EmbeddingModelId,
    settings?: AI302EmbeddingSettings,
  ): EmbeddingModelV3;

  /**
  Creates a text embedding model (alias for textEmbeddingModel).
  */
  embeddingModel(
    modelId: AI302EmbeddingModelId,
    settings?: AI302EmbeddingSettings,
  ): EmbeddingModelV3;

  /**
  Creates a model for image generation.
  */
  image(
    modelId: AI302ImageModelId,
    settings?: AI302ImageSettings,
  ): ImageModelV3;

  /**
  Creates a model for image generation (alias for image).
  */
  imageModel(
    modelId: AI302ImageModelId,
    settings?: AI302ImageSettings,
  ): ImageModelV3;

  /**
  Creates a model for speech generation (TTS).
  @param modelId Format: "provider/voice" e.g. "openai/alloy", "azure/zh-CN-XiaoxiaoNeural"
  */
  speech(modelId: AI302SpeechModelId): SpeechModelV3;

  /**
  Creates a model for speech generation (alias for speech).
  */
  speechModel(modelId: AI302SpeechModelId): SpeechModelV3;
}

const defaultBaseURL = 'https://api.302.ai';

export function createAI302(
  options: AI302ProviderSettings = {},
): AI302Provider {
  const baseURL = withoutTrailingSlash(options.baseURL) ?? defaultBaseURL;
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'AI302_API_KEY',
          description: '302 AI API key',
        })}`,
        'mj-api-secret': loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'AI302_API_KEY',
          description: 'Midjourney API key',
        }),
        ...options.headers,
      },
      `ai-sdk/ai302/${VERSION}`,
    );

  const getCommonModelConfig = (modelType: string): AI302Config => ({
    provider: `ai302.${modelType}`,
    url: ({ modelId, path }) => {
      if (modelType === 'embedding') {
        if (modelId.includes('jina')) {
          return `${baseURL}/jina/v1${path}`;
        }
        return `${baseURL}/v1${path}`;
      }
      return `${baseURL}${path}`;
    },
    headers: getHeaders,
    fetch: options.fetch,
  });

  const createImageModel = (
    modelId: AI302ImageModelId,
    settings?: AI302ImageSettings,
  ) => {
    return new AI302ImageModel(
      modelId,
      settings ?? {},
      getCommonModelConfig('image'),
    );
  };

  const createChatModel = (
    modelId: AI302ChatModelId,
    settings: AI302ChatSettings = {},
  ) => {
    return new AI302LanguageModel(modelId, getCommonModelConfig('chat'));
  };

  const createTextEmbeddingModel = (
    modelId: AI302EmbeddingModelId,
    settings: AI302EmbeddingSettings = {},
  ) => {
    // OpenAICompatibleEmbeddingModel doesn't support Resolvable headers yet,
    // so we create a sync version of the config
    const embeddingConfig = getCommonModelConfig('embedding');
    return new OpenAICompatibleEmbeddingModel(modelId, {
      provider: embeddingConfig.provider,
      url: embeddingConfig.url,
      headers: () => {
        const headers = embeddingConfig.headers();
        // If headers is a Promise, this would be a problem, but our implementation
        // returns sync headers from withUserAgentSuffix
        return headers as Record<string, string | undefined>;
      },
      fetch: embeddingConfig.fetch,
      errorStructure: ai302ErrorStructure,
    });
  };

  const createSpeechModel = (modelId: AI302SpeechModelId) => {
    return new AI302SpeechModel(modelId, getCommonModelConfig('speech'));
  };

  const provider = (modelId: AI302ChatModelId, settings?: AI302ChatSettings) =>
    createChatModel(modelId, settings);

  provider.specificationVersion = 'v3' as const;
  provider.languageModel = createChatModel;
  provider.chatModel = createChatModel;
  provider.textEmbeddingModel = createTextEmbeddingModel;
  provider.embeddingModel = createTextEmbeddingModel;
  provider.image = createImageModel;
  provider.imageModel = createImageModel;
  provider.speech = createSpeechModel;
  provider.speechModel = createSpeechModel;

  return provider as AI302Provider;
}

export const ai302 = createAI302();
