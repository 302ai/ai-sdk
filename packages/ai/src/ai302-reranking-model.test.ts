import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI302RerankingModel } from './ai302-reranking-model';
import { AI302Config } from './ai302-config';
import { FetchFunction } from '@ai-sdk/provider-utils';

// Mock VERSION
vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const dummyRerankingResults = [
  { index: 0, relevance_score: 0.95 },
  { index: 2, relevance_score: 0.78 },
  { index: 1, relevance_score: 0.45 },
];

const testDocuments = [
  'Organic skincare for sensitive skin',
  'New makeup trends',
  'Bio-Hautpflege für empfindliche Haut',
];

const testQuery = 'skincare products for sensitive skin';

function createTestConfig(
  overrides: Partial<AI302Config> = {},
): AI302Config {
  return {
    provider: 'ai302.reranking',
    url: ({ path }) => `https://api.302.ai${path}`,
    headers: () => ({
      Authorization: 'Bearer test-api-key',
    }),
    ...overrides,
  };
}

function createRerankingResponse({
  results = dummyRerankingResults,
}: {
  results?: Array<{ index: number; relevance_score: number }>;
} = {}) {
  return { results };
}

describe('AI302RerankingModel', () => {
  let capturedRequest: { url: string; init: RequestInit } | null = null;

  beforeEach(() => {
    capturedRequest = null;
  });

  function createMockFetch(response: unknown, status = 200): FetchFunction {
    return async (input, init) => {
      capturedRequest = { url: input.toString(), init: init ?? {} };
      return new Response(JSON.stringify(response), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  }

  describe('basic properties', () => {
    it('should have correct specification version', () => {
      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig(),
      );
      expect(model.specificationVersion).toBe('v3');
    });

    it('should have correct model ID', () => {
      const model = new AI302RerankingModel(
        'bge-reranker-v2-m3',
        createTestConfig(),
      );
      expect(model.modelId).toBe('bge-reranker-v2-m3');
    });

    it('should have correct provider', () => {
      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig(),
      );
      expect(model.provider).toBe('ai302.reranking');
    });
  });

  describe('doRerank', () => {
    it('should extract ranking from response', async () => {
      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      const result = await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
      });

      expect(result.ranking).toStrictEqual([
        { index: 0, relevanceScore: 0.95 },
        { index: 2, relevanceScore: 0.78 },
        { index: 1, relevanceScore: 0.45 },
      ]);
    });

    it('should send correct request body with text documents', async () => {
      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
      });

      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body).toStrictEqual({
        model: 'jina-reranker-v2-base-multilingual',
        query: testQuery,
        documents: testDocuments,
        return_documents: true,
      });
    });

    it('should convert object documents to strings', async () => {
      const objectDocs = [
        { title: 'Doc 1', content: 'Content 1' },
        { title: 'Doc 2', content: 'Content 2' },
      ];

      const model = new AI302RerankingModel(
        'bge-reranker-v2-m3',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      const result = await model.doRerank({
        documents: { type: 'object', values: objectDocs },
        query: testQuery,
      });

      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.documents).toStrictEqual([
        JSON.stringify(objectDocs[0]),
        JSON.stringify(objectDocs[1]),
      ]);

      // Should include warning about object conversion
      expect(result.warnings).toContainEqual({
        type: 'compatibility',
        feature: 'object documents',
        details: 'Object documents are converted to strings.',
      });
    });

    it('should pass topN parameter', async () => {
      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
        topN: 2,
      });

      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.top_n).toBe(2);
    });

    it('should include headers in request', async () => {
      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
      });

      const headers = new Headers(
        capturedRequest!.init.headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer test-api-key');
    });

    it('should merge custom headers', async () => {
      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
        headers: { 'X-Custom-Header': 'custom-value' },
      });

      const headers = new Headers(
        capturedRequest!.init.headers as HeadersInit,
      );
      expect(headers.get('X-Custom-Header')).toBe('custom-value');
    });
  });

  describe('URL generation', () => {
    it('should use /v1/rerank endpoint for all models', async () => {
      const models = [
        'jina-reranker-v2-base-multilingual',
        'bge-reranker-v2-m3',
        'bce-reranker-base_v1',
        'Qwen/Qwen3-Reranker-8B',
        'rerank-2.5',
      ];

      for (const modelId of models) {
        capturedRequest = null;
        const model = new AI302RerankingModel(
          modelId,
          createTestConfig({
            fetch: createMockFetch(createRerankingResponse()),
          }),
        );

        await model.doRerank({
          documents: { type: 'text', values: testDocuments },
          query: testQuery,
        });

        expect(capturedRequest!.url).toBe('https://api.302.ai/v1/rerank');
      }
    });
  });

  describe('provider options', () => {
    it('should pass returnDocuments option', async () => {
      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
        providerOptions: { ai302: { returnDocuments: false } },
      });

      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.return_documents).toBe(false);
    });

    it('should default returnDocuments to true', async () => {
      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
      });

      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.return_documents).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle API error response', async () => {
      const errorResponse = {
        error: {
          message: 'Invalid API key',
        },
      };

      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig({
          fetch: createMockFetch(errorResponse, 401),
        }),
      );

      await expect(
        model.doRerank({
          documents: { type: 'text', values: testDocuments },
          query: testQuery,
        }),
      ).rejects.toThrow(/Invalid API key/);
    });
  });

  describe('response metadata', () => {
    it('should include response headers', async () => {
      const customFetch: FetchFunction = async (input, init) => {
        capturedRequest = { url: input.toString(), init: init ?? {} };
        return new Response(JSON.stringify(createRerankingResponse()), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': 'req-123',
          },
        });
      };

      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig({ fetch: customFetch }),
      );

      const result = await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
      });

      expect(result.response?.headers).toBeDefined();
    });

    it('should include raw response body', async () => {
      const model = new AI302RerankingModel(
        'jina-reranker-v2-base-multilingual',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      const result = await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
      });

      expect(result.response?.body).toBeDefined();
      expect(result.response?.body).toHaveProperty('results');
    });
  });

  describe('different model types', () => {
    it('should work with Jina reranker models', async () => {
      const model = new AI302RerankingModel(
        'jina-reranker-v1-turbo-en',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      const result = await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
      });

      expect(result.ranking).toBeDefined();
      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.model).toBe('jina-reranker-v1-turbo-en');
    });

    it('should work with Qwen reranker models', async () => {
      const model = new AI302RerankingModel(
        'Qwen/Qwen3-Reranker-8B',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      const result = await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
      });

      expect(result.ranking).toBeDefined();
      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.model).toBe('Qwen/Qwen3-Reranker-8B');
    });

    it('should work with Voyage reranker models', async () => {
      const model = new AI302RerankingModel(
        'rerank-2.5-lite',
        createTestConfig({
          fetch: createMockFetch(createRerankingResponse()),
        }),
      );

      const result = await model.doRerank({
        documents: { type: 'text', values: testDocuments },
        query: testQuery,
      });

      expect(result.ranking).toBeDefined();
      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.model).toBe('rerank-2.5-lite');
    });
  });
});

