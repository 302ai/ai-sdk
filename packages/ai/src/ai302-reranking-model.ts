import { RerankingModelV3, SharedV3Warning } from '@ai-sdk/provider';
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
  AI302RerankingModelId,
  ai302RerankingProviderOptions,
} from './ai302-reranking-settings';

// Response schema for 302AI rerank API
const ai302RerankingResponseSchema = z.object({
  results: z.array(
    z.object({
      index: z.number(),
      relevance_score: z.number(),
    }),
  ),
});

// Error schema for 302AI API
const ai302ErrorSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
});

export class AI302RerankingModel implements RerankingModelV3 {
  readonly specificationVersion = 'v3';
  readonly modelId: AI302RerankingModelId;

  private readonly config: AI302Config;

  get provider(): string {
    return this.config.provider;
  }

  constructor(modelId: AI302RerankingModelId, config: AI302Config) {
    this.modelId = modelId;
    this.config = config;
  }

  async doRerank({
    documents,
    query,
    topN,
    headers,
    abortSignal,
    providerOptions,
  }: Parameters<RerankingModelV3['doRerank']>[0]): Promise<
    Awaited<ReturnType<RerankingModelV3['doRerank']>>
  > {
    const warnings: SharedV3Warning[] = [];

    // Parse provider options
    const ai302Options =
      (await parseProviderOptions({
        provider: 'ai302',
        providerOptions,
        schema: ai302RerankingProviderOptions,
      })) ?? {};

    // Convert object documents to strings with warning
    if (documents.type === 'object') {
      warnings.push({
        type: 'compatibility',
        feature: 'object documents',
        details: 'Object documents are converted to strings.',
      });
    }

    const documentStrings =
      documents.type === 'text'
        ? documents.values
        : documents.values.map(value => JSON.stringify(value));

    const resolvedHeaders = await resolve(this.config.headers());

    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postJsonToApi({
      url: this.config.url({
        path: '/v1/rerank',
        modelId: this.modelId,
      }),
      headers: combineHeaders(resolvedHeaders, headers),
      body: {
        model: this.modelId,
        query,
        documents: documentStrings,
        top_n: topN,
        return_documents: ai302Options.returnDocuments ?? true,
      },
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: ai302ErrorSchema,
        errorToMessage: error => error.error.message,
      }),
      successfulResponseHandler: createJsonResponseHandler(
        ai302RerankingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      ranking: response.results.map(result => ({
        index: result.index,
        relevanceScore: result.relevance_score,
      })),
      warnings,
      response: {
        headers: responseHeaders,
        body: rawValue,
      },
    };
  }
}

