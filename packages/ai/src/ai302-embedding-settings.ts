import { z } from 'zod';

/**
 * 302AI Embedding Model IDs
 *
 * Supported providers:
 * - OpenAI: text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002
 * - Jina: jina-clip-v1/v2, jina-embeddings-v2-base-*, jina-embeddings-v3
 * - Voyage: voyage-3-large, voyage-3.5, voyage-code-3, etc.
 * - Google: gemini-embedding-001
 * - Qwen: Qwen/Qwen3-Embedding-*
 * - 智谱: embedding-2, embedding-3, zhipu-embedding-2
 * - BAAI: BAAI/bge-large-*, BAAI/bge-m3
 * - Others: Baichuan-Text-Embedding, bce-embedding-base_v1
 */
export type AI302EmbeddingModelId =
  // OpenAI models
  | 'text-embedding-3-small'
  | 'text-embedding-3-large'
  | 'text-embedding-ada-002'
  // Jina models (use /jina/v1/embeddings path)
  | 'jina-clip-v1'
  | 'jina-clip-v2'
  | 'jina-embeddings-v2-base-en'
  | 'jina-embeddings-v2-base-es'
  | 'jina-embeddings-v2-base-de'
  | 'jina-embeddings-v2-base-zh'
  | 'jina-embeddings-v2-base-code'
  | 'jina-embeddings-v3'
  // Voyage models
  | 'voyage-3-large'
  | 'voyage-context-3'
  | 'voyage-3.5'
  | 'voyage-3.5-lite'
  | 'voyage-code-3'
  | 'voyage-finance-2'
  | 'voyage-law-2'
  | 'voyage-code-2'
  // Google models
  | 'gemini-embedding-001'
  // Qwen/硅基流动 models
  | 'Qwen/Qwen3-Embedding-8B'
  | 'Qwen/Qwen3-Embedding-4B'
  | 'Qwen/Qwen3-Embedding-0.6B'
  // 智谱 models
  | 'embedding-3'
  | 'embedding-2'
  | 'zhipu-embedding-2'
  // BAAI models
  | 'BAAI/bge-large-en-v1.5'
  | 'BAAI/bge-large-zh-v1.5'
  | 'BAAI/bge-m3'
  // Other models
  | 'Baichuan-Text-Embedding'
  | 'bce-embedding-base_v1'
  // Allow custom model IDs
  | (string & {});

/**
 * Provider options for 302AI embedding models
 */
export const ai302EmbeddingProviderOptions = z.object({
  /**
   * The number of dimensions the resulting output embeddings should have.
   * Only supported by some models (e.g., text-embedding-3-*).
   */
  dimensions: z.number().optional(),

  /**
   * A unique identifier representing your end-user.
   * Can help 302AI to monitor and detect abuse.
   */
  user: z.string().optional(),
});

export type AI302EmbeddingProviderOptions = z.infer<
  typeof ai302EmbeddingProviderOptions
>;

/**
 * Settings interface for AI302 embedding models
 * @deprecated Use providerOptions instead
 */
export interface AI302EmbeddingSettings {}
