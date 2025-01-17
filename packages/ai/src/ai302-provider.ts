import { ImageModelV1 } from '@ai-sdk/provider';
import { AI302ImageModelId, AI302ImageSettings } from './ai302-image-settings';
import {
  FetchFunction,
  loadApiKey,
  withoutTrailingSlash,
} from '@ai-sdk/provider-utils';
import { AI302ImageModel } from './ai302-image-model';
import { AI302Config } from './ai302-config';

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

export interface AI302Provider {
  image(modelId: AI302ImageModelId, settings?: AI302ImageSettings): ImageModelV1;
}

const defaultBaseURL = 'https://api.302.ai';

export function createAI302(
  options: AI302ProviderSettings = {},
): AI302Provider {
  const baseURL = withoutTrailingSlash(options.baseURL) ?? defaultBaseURL;
  const getHeaders = () => ({
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
  });

  const getCommonModelConfig = (modelType: string): AI302Config => ({
    provider: `ai302.${modelType}`,
    url: ({ path }) => `${baseURL}${path}`,
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

  const provider = () => {};
  provider.image = createImageModel;

  return provider as AI302Provider;
}

export const ai302 = createAI302();
