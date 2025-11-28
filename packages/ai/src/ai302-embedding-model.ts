import {
  EmbeddingModelV3,
  TooManyEmbeddingValuesForCallError,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  resolve,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { AI302Config } from './ai302-config';
import {
  AI302EmbeddingModelId,
  ai302EmbeddingProviderOptions,
} from './ai302-embedding-settings';

// Response schema for OpenAI-compatible embeddings API
const ai302EmbeddingResponseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })),
  usage: z.object({ prompt_tokens: z.number() }).nullish(),
});

// Error schema for 302AI API
const ai302ErrorSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
});

export class AI302EmbeddingModel implements EmbeddingModelV3 {
  readonly specificationVersion = 'v3';
  readonly modelId: AI302EmbeddingModelId;
  readonly maxEmbeddingsPerCall = 2048;
  readonly supportsParallelCalls = true;

  private readonly config: AI302Config;

  get provider(): string {
    return this.config.provider;
  }

  constructor(modelId: AI302EmbeddingModelId, config: AI302Config) {
    this.modelId = modelId;
    this.config = config;
  }

  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions,
  }: Parameters<EmbeddingModelV3['doEmbed']>[0]): Promise<
    Awaited<ReturnType<EmbeddingModelV3['doEmbed']>>
  > {
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values,
      });
    }

    // Parse provider options
    const ai302Options =
      (await parseProviderOptions({
        provider: 'ai302',
        providerOptions,
        schema: ai302EmbeddingProviderOptions,
      })) ?? {};

    const resolvedHeaders = await resolve(this.config.headers());

    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postJsonToApi({
      url: this.config.url({
        path: '/embeddings',
        modelId: this.modelId,
      }),
      headers: combineHeaders(resolvedHeaders, headers),
      body: {
        model: this.modelId,
        input: values,
        encoding_format: 'float',
        ...(ai302Options.dimensions !== undefined && {
          dimensions: ai302Options.dimensions,
        }),
        ...(ai302Options.user !== undefined && { user: ai302Options.user }),
      },
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: ai302ErrorSchema,
        errorToMessage: error => error.error.message,
      }),
      successfulResponseHandler: createJsonResponseHandler(
        ai302EmbeddingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      embeddings: response.data.map(item => item.embedding),
      usage: response.usage
        ? { tokens: response.usage.prompt_tokens }
        : undefined,
      response: { headers: responseHeaders, body: rawValue },
    };
  }
}

