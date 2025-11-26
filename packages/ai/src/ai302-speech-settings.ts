import { z } from 'zod';

/**
 * 302AI TTS Provider types
 */
export type AI302TTSProvider =
  | 'openai'
  | 'doubao'
  | 'azure'
  | 'fish'
  | 'minimaxi'
  | 'dubbingx'
  | 'elevenlabs'
  | 'elevenlabs-official'
  | 'meruka'
  | 'google'
  | 'qwen';

/**
 * 302AI Speech Model ID
 * Format: "provider/voice" e.g. "openai/alloy", "azure/zh-CN-XiaoxiaoNeural"
 */
export type AI302SpeechModelId = `${AI302TTSProvider}/${string}` | (string & {});

/**
 * Provider-specific options for 302AI TTS
 */
export const ai302SpeechProviderOptionsSchema = z.object({
  /**
   * Enable async mode for long text processing
   */
  runAsync: z.boolean().optional(),

  /**
   * Webhook URL for async notifications
   */
  webhook: z.string().optional(),

  /**
   * Request timeout in seconds (default: 180)
   */
  timeout: z.number().optional(),

  /**
   * TTS model (required by some providers)
   */
  model: z.string().optional(),

  /**
   * Volume level (0-1, default: 1)
   */
  volume: z.number().min(0).max(2).optional(),

  /**
   * Emotion for speech (supported by some providers)
   */
  emotion: z.string().optional(),

  /**
   * Poll interval in milliseconds for async mode (default: 2000)
   */
  pollInterval: z.number().optional(),

  /**
   * Maximum number of poll attempts for async mode (default: 90)
   */
  maxPollAttempts: z.number().optional(),
});

export type AI302SpeechProviderOptions = z.infer<
  typeof ai302SpeechProviderOptionsSchema
>;

/**
 * 302AI TTS API request body
 */
export interface AI302TTSRequestBody {
  text: string;
  provider: string;
  voice: string;
  model?: string;
  speed?: number;
  volume?: number;
  emotion?: string;
  output_format?: string;
  timeout?: number;
}

/**
 * 302AI TTS API response (sync mode)
 */
export interface AI302TTSSyncResponse {
  task_id: string;
  status: 'completed' | 'failed';
  created_at: string;
  completed_at: string;
  audio_url: string;
  raw_response: {
    audio: {
      url: string;
      content_type: string;
      file_size: number;
    };
    timestamps: unknown;
  };
}

/**
 * 302AI TTS API response (async mode - initial)
 */
export interface AI302TTSAsyncResponse {
  task_id: string;
  status: 'pending';
  created_at: string;
}

/**
 * 302AI TTS task status response
 */
export interface AI302TTSTaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  provider: string;
  model: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  audio_url?: string;
  execution_time?: string;
  raw_response?: unknown;
}

