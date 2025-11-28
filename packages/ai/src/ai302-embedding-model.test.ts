import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI302EmbeddingModel } from './ai302-embedding-model';
import { AI302Config } from './ai302-config';
import { FetchFunction } from '@ai-sdk/provider-utils';

// Mock VERSION
vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const dummyEmbeddings = [
  [0.1, 0.2, 0.3, 0.4, 0.5],
  [0.6, 0.7, 0.8, 0.9, 1.0],
];

const testValues = ['sunny day at the beach', 'rainy day in the city'];

function createTestConfig(
  overrides: Partial<AI302Config> = {},
): AI302Config {
  return {
    provider: 'ai302.embedding',
    url: ({ modelId, path }) => {
      if (modelId.includes('jina')) {
        return `https://api.302.ai/jina/v1${path}`;
      }
      return `https://api.302.ai/v1${path}`;
    },
    headers: () => ({
      Authorization: 'Bearer test-api-key',
    }),
    ...overrides,
  };
}

function createOpenAIEmbeddingResponse({
  embeddings = dummyEmbeddings,
  usage = { prompt_tokens: 8, total_tokens: 8 },
  model = 'text-embedding-3-small',
}: {
  embeddings?: number[][];
  usage?: { prompt_tokens: number; total_tokens: number };
  model?: string;
} = {}) {
  return {
    object: 'list',
    data: embeddings.map((embedding, i) => ({
      object: 'embedding',
      index: i,
      embedding,
    })),
    model,
    usage,
  };
}

describe('AI302EmbeddingModel', () => {
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
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig(),
      );
      expect(model.specificationVersion).toBe('v3');
    });

    it('should have correct model ID', () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-large',
        createTestConfig(),
      );
      expect(model.modelId).toBe('text-embedding-3-large');
    });

    it('should have correct provider', () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig(),
      );
      expect(model.provider).toBe('ai302.embedding');
    });

    it('should have correct maxEmbeddingsPerCall', () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig(),
      );
      expect(model.maxEmbeddingsPerCall).toBe(2048);
    });

    it('should support parallel calls', () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig(),
      );
      expect(model.supportsParallelCalls).toBe(true);
    });
  });

  describe('doEmbed', () => {
    it('should extract embeddings from response', async () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      const result = await model.doEmbed({ values: testValues });

      expect(result.embeddings).toStrictEqual(dummyEmbeddings);
    });

    it('should extract usage from response', async () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(
            createOpenAIEmbeddingResponse({
              usage: { prompt_tokens: 42, total_tokens: 42 },
            }),
          ),
        }),
      );

      const result = await model.doEmbed({ values: testValues });

      expect(result.usage).toStrictEqual({ tokens: 42 });
    });

    it('should handle missing usage in response', async () => {
      const response = createOpenAIEmbeddingResponse();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response as any).usage = null;

      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(response),
        }),
      );

      const result = await model.doEmbed({ values: testValues });

      expect(result.usage).toBeUndefined();
    });

    it('should send correct request body', async () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      await model.doEmbed({ values: testValues });

      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body).toStrictEqual({
        model: 'text-embedding-3-small',
        input: testValues,
        encoding_format: 'float',
      });
    });

    it('should include headers in request', async () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      await model.doEmbed({ values: testValues });

      const headers = new Headers(
        capturedRequest!.init.headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer test-api-key');
    });

    it('should merge custom headers', async () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      await model.doEmbed({
        values: testValues,
        headers: { 'X-Custom-Header': 'custom-value' },
      });

      const headers = new Headers(
        capturedRequest!.init.headers as HeadersInit,
      );
      expect(headers.get('X-Custom-Header')).toBe('custom-value');
    });
  });

  describe('URL routing', () => {
    it('should use /v1/embeddings for OpenAI models', async () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      await model.doEmbed({ values: testValues });

      expect(capturedRequest!.url).toBe(
        'https://api.302.ai/v1/embeddings',
      );
    });

    it('should use /jina/v1/embeddings for Jina models', async () => {
      const model = new AI302EmbeddingModel(
        'jina-embeddings-v3',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      await model.doEmbed({ values: testValues });

      expect(capturedRequest!.url).toBe(
        'https://api.302.ai/jina/v1/embeddings',
      );
    });

    it('should use /v1/embeddings for Voyage models', async () => {
      const model = new AI302EmbeddingModel(
        'voyage-3.5',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      await model.doEmbed({ values: testValues });

      expect(capturedRequest!.url).toBe(
        'https://api.302.ai/v1/embeddings',
      );
    });

    it('should use /v1/embeddings for BAAI models', async () => {
      const model = new AI302EmbeddingModel(
        'BAAI/bge-m3',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      await model.doEmbed({ values: testValues });

      expect(capturedRequest!.url).toBe(
        'https://api.302.ai/v1/embeddings',
      );
    });
  });

  describe('provider options', () => {
    it('should pass dimensions option in request body', async () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-large',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      await model.doEmbed({
        values: testValues,
        providerOptions: { ai302: { dimensions: 512 } },
      });

      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.dimensions).toBe(512);
    });

    it('should pass user option in request body', async () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      await model.doEmbed({
        values: testValues,
        providerOptions: { ai302: { user: 'user-123' } },
      });

      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.user).toBe('user-123');
    });

    it('should not include undefined options in request body', async () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      await model.doEmbed({ values: testValues });

      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body).not.toHaveProperty('dimensions');
      expect(body).not.toHaveProperty('user');
    });
  });

  describe('error handling', () => {
    it('should throw TooManyEmbeddingValuesForCallError when exceeding limit', async () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      // Create more values than maxEmbeddingsPerCall (2048)
      const tooManyValues = Array(2049).fill('test value');

      await expect(model.doEmbed({ values: tooManyValues })).rejects.toThrow(
        /too many/i,
      );
    });

    it('should handle API error response', async () => {
      const errorResponse = {
        error: {
          message: 'Invalid API key',
        },
      };

      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(errorResponse, 401),
        }),
      );

      await expect(model.doEmbed({ values: testValues })).rejects.toThrow(
        /Invalid API key/,
      );
    });
  });

  describe('response metadata', () => {
    it('should include response headers', async () => {
      const customFetch: FetchFunction = async (input, init) => {
        capturedRequest = { url: input.toString(), init: init ?? {} };
        return new Response(JSON.stringify(createOpenAIEmbeddingResponse()), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': 'req-123',
          },
        });
      };

      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({ fetch: customFetch }),
      );

      const result = await model.doEmbed({ values: testValues });

      expect(result.response?.headers).toBeDefined();
    });

    it('should include raw response body', async () => {
      const model = new AI302EmbeddingModel(
        'text-embedding-3-small',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      const result = await model.doEmbed({ values: testValues });

      expect(result.response?.body).toBeDefined();
      expect(result.response?.body).toHaveProperty('object', 'list');
    });
  });

  describe('different model types', () => {
    it('should work with Qwen embedding models', async () => {
      const model = new AI302EmbeddingModel(
        'Qwen/Qwen3-Embedding-8B',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      const result = await model.doEmbed({ values: testValues });

      expect(result.embeddings).toStrictEqual(dummyEmbeddings);
      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.model).toBe('Qwen/Qwen3-Embedding-8B');
    });

    it('should work with 智谱 embedding models', async () => {
      const model = new AI302EmbeddingModel(
        'embedding-3',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      const result = await model.doEmbed({ values: testValues });

      expect(result.embeddings).toStrictEqual(dummyEmbeddings);
      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.model).toBe('embedding-3');
    });

    it('should work with Google embedding models', async () => {
      const model = new AI302EmbeddingModel(
        'gemini-embedding-001',
        createTestConfig({
          fetch: createMockFetch(createOpenAIEmbeddingResponse()),
        }),
      );

      const result = await model.doEmbed({ values: testValues });

      expect(result.embeddings).toStrictEqual(dummyEmbeddings);
      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body.model).toBe('gemini-embedding-001');
    });
  });
});

