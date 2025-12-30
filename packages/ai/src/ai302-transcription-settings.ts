import { InferSchema, lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';

/**
 * 302AI Transcription Provider types
 */
export type AI302TranscriptionProvider =
  | 'openai'
  | 'doubao'
  | 'elevenlabs'
  | 'siliconflow';

/**
 * 302AI Transcription Model ID
 */
export type AI302TranscriptionModelId =
  // OpenAI models
  | 'whisper-1'
  | 'gpt-4o-transcribe'
  | 'gpt-4o-mini-transcribe'
  | 'gpt-4o-transcribe-diarize'
  // Doubao models
  | 'recognize'
  // ElevenLabs models
  | 'scribe_v1'
  | 'scribe_v1_experimental'
  // SiliconFlow models
  | 'sensevoice'
  | (string & {});

/**
 * Response format for transcription API
 */
export type AI302TranscriptionResponseFormat =
  | 'json'
  | 'text'
  | 'srt'
  | 'vtt'
  | 'verbose_json'
  | 'diarized_json';

/**
 * Provider-specific options for 302AI Transcription
 */
export const ai302TranscriptionProviderOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      /**
       * The language of the input audio in ISO-639-1 format.
       * Supplying the input language helps with accuracy and latency.
       */
      language: z.string().optional(),

      /**
       * An optional text to guide the model's style or continue a previous audio segment.
       * The prompt should match the audio language.
       */
      prompt: z.string().optional(),

      /**
       * The sampling temperature, between 0 and 1.
       * Higher values like 0.8 will make the output more random,
       * while lower values like 0.2 will make it more focused and deterministic.
       * @default 0
       */
      temperature: z.number().min(0).max(1).optional(),

      /**
       * The format of the transcription response.
       * - 'json': Basic JSON with text field
       * - 'text': Plain text only
       * - 'srt': SubRip subtitle format
       * - 'vtt': WebVTT subtitle format
       * - 'verbose_json': Detailed JSON with segments, words, timestamps, etc.
       * - 'diarized_json': JSON with speaker diarization (gpt-4o-transcribe-diarize only)
       * @default 'verbose_json' for most models, 'json' for gpt-4o transcribe models
       */
      responseFormat: z
        .enum(['json', 'text', 'srt', 'vtt', 'verbose_json', 'diarized_json'])
        .optional(),

      /**
       * The timestamp granularities to populate for this transcription.
       * @default ['segment']
       */
      timestampGranularities: z
        .array(z.enum(['word', 'segment']))
        .optional(),

      /**
       * Additional information to include in the transcription response.
       * (OpenAI specific)
       */
      include: z.array(z.string()).optional(),
    }),
  ),
);

export type AI302TranscriptionProviderOptions = InferSchema<
  typeof ai302TranscriptionProviderOptionsSchema
>;

