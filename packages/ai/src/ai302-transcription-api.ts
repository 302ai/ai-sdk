import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';

/**
 * Schema for verbose_json response format (OpenAI compatible)
 * Same as openaiTranscriptionResponseSchema
 */
export const ai302TranscriptionVerboseResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      task: z.string().nullish(),
      text: z.string(),
      language: z.string().nullish(),
      duration: z.number().nullish(),
      words: z
        .array(
          z.object({
            word: z.string(),
            start: z.number(),
            end: z.number(),
          }),
        )
        .nullish(),
      segments: z
        .array(
          z.object({
            id: z.number(),
            seek: z.number(),
            start: z.number(),
            end: z.number(),
            text: z.string(),
            tokens: z.array(z.number()),
            temperature: z.number(),
            avg_logprob: z.number(),
            compression_ratio: z.number(),
            no_speech_prob: z.number(),
          }),
        )
        .nullish(),
    }),
  ),
);

/**
 * Schema for basic json response format
 */
export const ai302TranscriptionJsonResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      text: z.string(),
      usage: z
        .object({
          type: z.string().optional(),
          total_tokens: z.number().optional(),
          input_tokens: z.number().optional(),
          input_token_details: z
            .object({
              text_tokens: z.number().optional(),
              audio_tokens: z.number().optional(),
            })
            .optional(),
          output_tokens: z.number().optional(),
        })
        .nullish(),
    }),
  ),
);

/**
 * Schema for diarized_json response format (speaker diarization)
 */
export const ai302TranscriptionDiarizedResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      text: z.string(),
      segments: z
        .array(
          z.object({
            type: z.string().optional(),
            text: z.string(),
            speaker: z.string(),
            start: z.number(),
            end: z.number(),
            id: z.string(),
          }),
        )
        .nullish(),
      usage: z
        .object({
          type: z.string().optional(),
          total_tokens: z.number().optional(),
          input_tokens: z.number().optional(),
          input_token_details: z
            .object({
              text_tokens: z.number().optional(),
              audio_tokens: z.number().optional(),
            })
            .optional(),
          output_tokens: z.number().optional(),
        })
        .nullish(),
    }),
  ),
);

/**
 * Union type for all possible transcription responses
 */
export type AI302TranscriptionVerboseResponse = {
  task?: string | null;
  text: string;
  language?: string | null;
  duration?: number | null;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }> | null;
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }> | null;
};

export type AI302TranscriptionJsonResponse = {
  text: string;
  usage?: {
    type?: string;
    total_tokens?: number;
    input_tokens?: number;
    input_token_details?: {
      text_tokens?: number;
      audio_tokens?: number;
    };
    output_tokens?: number;
  } | null;
};

export type AI302TranscriptionDiarizedResponse = {
  text: string;
  segments?: Array<{
    type?: string;
    text: string;
    speaker: string;
    start: number;
    end: number;
    id: string;
  }> | null;
  usage?: {
    type?: string;
    total_tokens?: number;
    input_tokens?: number;
    input_token_details?: {
      text_tokens?: number;
      audio_tokens?: number;
    };
    output_tokens?: number;
  } | null;
};

