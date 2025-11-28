import { z } from 'zod';

/**
 * 302AI Reranking Model IDs
 *
 * Supported providers:
 * - Jina: jina-reranker-v2-base-multilingual, jina-reranker-v1-*, jina-colbert-v1-en
 * - BCE (有道): bce-reranker-base_v1
 * - BAAI (智源): bge-reranker-v2-m3
 * - Qwen (硅基流动): Qwen/Qwen3-Reranker-*
 * - Voyage: rerank-2.5, rerank-2.5-lite
 */
export type AI302RerankingModelId =
  // Jina models
  | 'jina-reranker-v2-base-multilingual'
  | 'jina-reranker-v1-base-en'
  | 'jina-reranker-v1-tiny-en'
  | 'jina-reranker-v1-turbo-en'
  | 'jina-colbert-v1-en'
  // BCE (有道)
  | 'bce-reranker-base_v1'
  // BAAI (智源)
  | 'bge-reranker-v2-m3'
  // Qwen (硅基流动)
  | 'Qwen/Qwen3-Reranker-8B'
  | 'Qwen/Qwen3-Reranker-4B'
  | 'Qwen/Qwen3-Reranker-0.6B'
  // Voyage
  | 'rerank-2.5'
  | 'rerank-2.5-lite'
  // Allow custom model IDs
  | (string & {});

/**
 * Provider options for 302AI reranking models
 */
export const ai302RerankingProviderOptions = z.object({
  /**
   * Whether to return the documents in the response.
   * @default true
   */
  returnDocuments: z.boolean().optional(),
});

export type AI302RerankingProviderOptions = z.infer<
  typeof ai302RerankingProviderOptions
>;

