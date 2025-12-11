import { resolve } from '@ai-sdk/provider-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAI302, ai302 } from './ai302-provider';
import { AI302LanguageModel } from './ai302-language-model';
import { AI302ImageModel } from './ai302-image-model';
import { AI302EmbeddingModel } from './ai302-embedding-model';
import { AI302RerankingModel } from './ai302-reranking-model';

vi.mock('./ai302-language-model', () => ({
  AI302LanguageModel: vi.fn(),
}));

vi.mock('./ai302-image-model', () => ({
  AI302ImageModel: vi.fn(),
}));

vi.mock('./ai302-embedding-model', () => ({
  AI302EmbeddingModel: vi.fn(),
}));

vi.mock('./ai302-reranking-model', () => ({
  AI302RerankingModel: vi.fn(),
}));

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

describe('AI302Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAI302', () => {
    it('should create provider with correct configuration', async () => {
      const options = {
        baseURL: 'https://api.example.com',
        apiKey: 'test-api-key',
        headers: { 'Custom-Header': 'value' },
      };

      const provider = createAI302(options);
      provider('gpt-4o');

      expect(AI302LanguageModel).toHaveBeenCalledWith(
        'gpt-4o',
        {},  // settings
        expect.objectContaining({
          provider: 'ai302.chat',
          url: expect.any(Function),
          headers: expect.any(Function),
          fetch: undefined,
        }),
      );

      // Verify headers function
      const constructorCall = vi.mocked(AI302LanguageModel).mock.calls[0];
      const config = constructorCall[2];
      const headers = await resolve(config.headers());

      expect(headers).toMatchObject({
        authorization: 'Bearer test-api-key',
        'custom-header': 'value',
        'user-agent': 'ai-sdk/ai302/0.0.0-test',
      });
    });

    it('should use default baseURL when none is provided', () => {
      const provider = createAI302({
        apiKey: 'test-key',
      });

      provider('gpt-4o');

      const constructorCall = vi.mocked(AI302LanguageModel).mock.calls[0];
      const config = constructorCall[2];
      const url = config.url({ modelId: 'gpt-4o', path: '/v1/chat/completions' });

      expect(url).toBe('https://api.302.ai/v1/chat/completions');
    });

    it('should read API key from environment variable', async () => {
      const originalEnv = process.env.AI302_API_KEY;
      process.env.AI302_API_KEY = 'env-api-key';

      try {
        const provider = createAI302();
        provider('gpt-4o');

        const constructorCall = vi.mocked(AI302LanguageModel).mock.calls[0];
        const config = constructorCall[2];
        const headers = await resolve(config.headers());

        expect(headers.authorization).toBe('Bearer env-api-key');
      } finally {
        if (originalEnv) {
          process.env.AI302_API_KEY = originalEnv;
        } else {
          delete process.env.AI302_API_KEY;
        }
      }
    });

    it('should prefer options apiKey over environment variable', async () => {
      const originalEnv = process.env.AI302_API_KEY;
      process.env.AI302_API_KEY = 'env-api-key';

      try {
        const provider = createAI302({
          apiKey: 'options-api-key',
        });
        provider('gpt-4o');

        const constructorCall = vi.mocked(AI302LanguageModel).mock.calls[0];
        const config = constructorCall[2];
        const headers = await resolve(config.headers());

        expect(headers.authorization).toBe('Bearer options-api-key');
      } finally {
        if (originalEnv) {
          process.env.AI302_API_KEY = originalEnv;
        } else {
          delete process.env.AI302_API_KEY;
        }
      }
    });

    it('should create AI302ImageModel for image models', () => {
      const provider = createAI302({
        apiKey: 'test-key',
      });

      provider.image('dall-e-3');

      expect(AI302ImageModel).toHaveBeenCalledWith(
        'dall-e-3',
        {},
        expect.objectContaining({
          provider: 'ai302.image',
          url: expect.any(Function),
          headers: expect.any(Function),
          fetch: undefined,
        }),
      );
    });

    it('should create AI302EmbeddingModel for embedding models', () => {
      const provider = createAI302({
        apiKey: 'test-key',
      });

      provider.textEmbeddingModel('text-embedding-3-small');

      expect(AI302EmbeddingModel).toHaveBeenCalledWith(
        'text-embedding-3-small',
        expect.objectContaining({
          provider: 'ai302.embedding',
          url: expect.any(Function),
          headers: expect.any(Function),
          fetch: undefined,
        }),
      );
    });

    it('should support languageModel method', () => {
      const provider = createAI302({
        apiKey: 'test-key',
      });

      provider.languageModel('gpt-4o');

      expect(AI302LanguageModel).toHaveBeenCalledWith(
        'gpt-4o',
        {},  // settings
        expect.objectContaining({
          provider: 'ai302.chat',
        }),
      );
    });

    it('should support chatModel method', () => {
      const provider = createAI302({
        apiKey: 'test-key',
      });

      provider.chatModel('gpt-4o');

      expect(AI302LanguageModel).toHaveBeenCalledWith(
        'gpt-4o',
        {},  // settings
        expect.objectContaining({
          provider: 'ai302.chat',
        }),
      );
    });

    it('should support embeddingModel method', () => {
      const provider = createAI302({
        apiKey: 'test-key',
      });

      provider.embeddingModel('text-embedding-3-small');

      expect(AI302EmbeddingModel).toHaveBeenCalledWith(
        'text-embedding-3-small',
        expect.any(Object),
      );
    });

    it('should support imageModel method', () => {
      const provider = createAI302({
        apiKey: 'test-key',
      });

      provider.imageModel('dall-e-3');

      expect(AI302ImageModel).toHaveBeenCalledWith(
        'dall-e-3',
        {},
        expect.any(Object),
      );
    });

    it('should have specificationVersion property', () => {
      const provider = createAI302({
        apiKey: 'test-key',
      });

      expect(provider.specificationVersion).toBe('v3');
    });

    it('should pass custom fetch function to models', () => {
      const customFetch = vi.fn();
      const provider = createAI302({
        apiKey: 'test-key',
        fetch: customFetch,
      });

      provider('gpt-4o');

      const constructorCall = vi.mocked(AI302LanguageModel).mock.calls[0];
      const config = constructorCall[2];

      expect(config.fetch).toBe(customFetch);
    });

    it('should handle baseURL with trailing slash', () => {
      const provider = createAI302({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com/',
      });

      provider('gpt-4o');

      const constructorCall = vi.mocked(AI302LanguageModel).mock.calls[0];
      const config = constructorCall[2];
      const url = config.url({ modelId: 'gpt-4o', path: '/v1/chat/completions' });

      // Should remove trailing slash
      expect(url).toBe('https://api.example.com/v1/chat/completions');
    });

    it('should generate correct URLs for chat models', () => {
      const provider = createAI302({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com',
      });

      provider('gpt-4o');

      const constructorCall = vi.mocked(AI302LanguageModel).mock.calls[0];
      const config = constructorCall[2];
      const url = config.url({ modelId: 'gpt-4o', path: '/v1/chat/completions' });

      expect(url).toBe('https://api.example.com/v1/chat/completions');
    });

    it('should generate correct URLs for embedding models with jina', () => {
      const provider = createAI302({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com',
      });

      provider.textEmbeddingModel('jina-embeddings-v3');

      const constructorCall = vi.mocked(AI302EmbeddingModel).mock.calls[0];
      const config = constructorCall[1];
      const url = config.url({ modelId: 'jina-embeddings-v3', path: '/embeddings' });

      // jina models should use /jina/v1 prefix
      expect(url).toBe('https://api.example.com/jina/v1/embeddings');
    });

    it('should generate correct URLs for non-jina embedding models', () => {
      const provider = createAI302({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com',
      });

      provider.textEmbeddingModel('text-embedding-3-small');

      const constructorCall = vi.mocked(AI302EmbeddingModel).mock.calls[0];
      const config = constructorCall[1];
      const url = config.url({ modelId: 'text-embedding-3-small', path: '/embeddings' });

      expect(url).toBe('https://api.example.com/v1/embeddings');
    });

    it('should include mj-api-secret header for midjourney models', async () => {
      const provider = createAI302({
        apiKey: 'test-api-key',
      });

      provider.image('midjourney/6.0');

      const constructorCall = vi.mocked(AI302ImageModel).mock.calls[0];
      const config = constructorCall[2];
      const headers = await resolve(config.midjourneyHeaders!());

      expect(headers['mj-api-secret']).toBe('test-api-key');
    });

    it('should merge custom headers with default headers', async () => {
      const provider = createAI302({
        apiKey: 'test-key',
        headers: {
          'Custom-Header-1': 'value1',
          'Custom-Header-2': 'value2',
        },
      });

      provider('gpt-4o');

      const constructorCall = vi.mocked(AI302LanguageModel).mock.calls[0];
      const config = constructorCall[2];
      const headers = await resolve(config.headers());

      expect(headers).toMatchObject({
        authorization: 'Bearer test-key',
        'custom-header-1': 'value1',
        'custom-header-2': 'value2',
      });
    });

    it('should include version in user-agent header', async () => {
      const provider = createAI302({
        apiKey: 'test-key',
      });

      provider('gpt-4o');

      const constructorCall = vi.mocked(AI302LanguageModel).mock.calls[0];
      const config = constructorCall[2];
      const headers = await resolve(config.headers());

      expect(headers['user-agent']).toContain('ai-sdk/ai302/0.0.0-test');
    });
  });

  describe('default exported provider', () => {
    it('should export a default provider instance', () => {
      expect(ai302).toBeDefined();
      expect(typeof ai302).toBe('function');
      expect(typeof ai302.languageModel).toBe('function');
      expect(typeof ai302.chatModel).toBe('function');
      expect(typeof ai302.textEmbeddingModel).toBe('function');
      expect(typeof ai302.embeddingModel).toBe('function');
      expect(typeof ai302.image).toBe('function');
      expect(typeof ai302.imageModel).toBe('function');
      expect(typeof ai302.reranking).toBe('function');
      expect(typeof ai302.rerankingModel).toBe('function');
    });

    it('should have specificationVersion property', () => {
      expect(ai302.specificationVersion).toBe('v3');
    });

    it('should use default baseURL', () => {
      ai302('gpt-4o');

      const constructorCall = vi.mocked(AI302LanguageModel).mock.calls[0];
      const config = constructorCall[2];
      const url = config.url({ modelId: 'gpt-4o', path: '/v1/chat/completions' });

      expect(url).toBe('https://api.302.ai/v1/chat/completions');
    });
  });

  describe('Provider URL generation', () => {
    it('should use baseURL for regular paths', () => {
      const provider = createAI302({
        apiKey: 'test-key',
        baseURL: 'https://custom.api.com',
      });

      provider('gpt-4o');

      const constructorCall = vi.mocked(AI302LanguageModel).mock.calls[0];
      const config = constructorCall[2];

      expect(config.url({ modelId: 'gpt-4o', path: '/v1/chat/completions' }))
        .toBe('https://custom.api.com/v1/chat/completions');
    });

    it('should handle different model types with same base URL', () => {
      const provider = createAI302({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com',
      });

      // Chat model
      provider('gpt-4o');
      const chatConfig = vi.mocked(AI302LanguageModel).mock.calls[0][2];
      expect(chatConfig.url({ modelId: 'gpt-4o', path: '/v1/chat/completions' }))
        .toBe('https://api.example.com/v1/chat/completions');

      // Image model
      provider.image('dall-e-3');
      const imageConfig = vi.mocked(AI302ImageModel).mock.calls[0][2];
      expect(imageConfig.url({ modelId: 'dall-e-3', path: '/v1/images/generations' }))
        .toBe('https://api.example.com/v1/images/generations');

      // Embedding model
      provider.textEmbeddingModel('text-embedding-3-small');
      const embeddingConfig = vi.mocked(AI302EmbeddingModel).mock.calls[0][1];
      expect(embeddingConfig.url({ modelId: 'text-embedding-3-small', path: '/embeddings' }))
        .toBe('https://api.example.com/v1/embeddings');
    });
  });

  describe('Provider type definitions', () => {
    it('should accept valid chat model IDs', () => {
      const provider = createAI302({ apiKey: 'test-key' });

      // These should compile without errors
      provider('gpt-4o');
      provider('gpt-4');
      provider('gpt-3.5-turbo');
      provider('claude-3-opus');
    });

    it('should accept valid image model IDs', () => {
      const provider = createAI302({ apiKey: 'test-key' });

      // These should compile without errors
      provider.image('dall-e-3');
      provider.image('midjourney/6.0');
      provider.image('flux-pro');
    });

    it('should accept valid embedding model IDs', () => {
      const provider = createAI302({ apiKey: 'test-key' });

      // These should compile without errors
      provider.textEmbeddingModel('text-embedding-3-small');
      provider.textEmbeddingModel('text-embedding-3-large');
    });

    it('should accept valid reranking model IDs', () => {
      const provider = createAI302({ apiKey: 'test-key' });

      // These should compile without errors
      provider.reranking('jina-reranker-v2-base-multilingual');
      provider.reranking('bge-reranker-v2-m3');
      provider.rerankingModel('Qwen/Qwen3-Reranker-8B');
    });
  });

  describe('Reranking model', () => {
    it('should create AI302RerankingModel for reranking models', () => {
      const provider = createAI302({
        apiKey: 'test-key',
      });

      provider.reranking('jina-reranker-v2-base-multilingual');

      expect(AI302RerankingModel).toHaveBeenCalledWith(
        'jina-reranker-v2-base-multilingual',
        expect.objectContaining({
          provider: 'ai302.reranking',
          url: expect.any(Function),
          headers: expect.any(Function),
          fetch: undefined,
        }),
      );
    });

    it('should support rerankingModel method', () => {
      const provider = createAI302({
        apiKey: 'test-key',
      });

      provider.rerankingModel('bge-reranker-v2-m3');

      expect(AI302RerankingModel).toHaveBeenCalledWith(
        'bge-reranker-v2-m3',
        expect.any(Object),
      );
    });

    it('should generate correct URL for reranking models', () => {
      const provider = createAI302({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com',
      });

      provider.reranking('jina-reranker-v2-base-multilingual');

      const constructorCall = vi.mocked(AI302RerankingModel).mock.calls[0];
      const config = constructorCall[1];
      const url = config.url({ modelId: 'jina-reranker-v2-base-multilingual', path: '/v1/rerank' });

      // All reranking models use /v1/rerank (not /jina/v1/rerank)
      expect(url).toBe('https://api.example.com/v1/rerank');
    });
  });
});

