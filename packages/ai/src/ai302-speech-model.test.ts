import type { FetchFunction } from '@ai-sdk/provider-utils';
import { AI302SpeechModel } from './ai302-speech-model';
import type { AI302Config } from './ai302-config';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock response for sync TTS
function createSyncTTSResponse(audioUrl: string) {
  return {
    task_id: 'task_123',
    status: 'completed',
    created_at: '2025-01-01T00:00:00Z',
    completed_at: '2025-01-01T00:00:01Z',
    audio_url: audioUrl,
    raw_response: {
      audio: {
        url: audioUrl,
        content_type: 'audio/mpeg',
        file_size: 12345,
      },
      timestamps: null,
    },
  };
}

// Mock response for async TTS (initial)
function createAsyncTTSResponse(taskId: string) {
  return {
    task_id: taskId,
    status: 'pending',
    created_at: '2025-01-01T00:00:00Z',
  };
}

// Mock response for task status
function createTaskStatusResponse(
  taskId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  audioUrl?: string,
) {
  return {
    task_id: taskId,
    status,
    audio_url: audioUrl,
    completed_at: status === 'completed' ? '2025-01-01T00:00:05Z' : undefined,
  };
}

// Create mock audio data
function createMockAudioData(): Uint8Array {
  return new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]); // MP3 header bytes
}

let mockFetch: FetchFunction;
let capturedRequest: { url: string; init: RequestInit } | null;

const createTestModel = (
  modelId: string,
  config: Partial<AI302Config> = {},
) => {
  return new AI302SpeechModel(modelId, {
    provider: 'ai302.speech',
    url: ({ path }) => `https://api.302.ai${path}`,
    headers: () => ({
      Authorization: 'Bearer test-token',
    }),
    fetch: mockFetch,
    ...config,
  });
};

describe('AI302SpeechModel', () => {
  beforeEach(() => {
    capturedRequest = null;
    mockFetch = vi.fn() as FetchFunction;
  });

  describe('constructor', () => {
    it('should set basic properties', () => {
      const model = createTestModel('openai/alloy');
      expect(model.modelId).toBe('openai/alloy');
      expect(model.provider).toBe('ai302.speech');
      expect(model.specificationVersion).toBe('v3');
    });
  });

  describe('parseModelId', () => {
    it('should parse provider/voice format', async () => {
      const audioUrl = 'https://file.302.ai/audio.mp3';
      const audioData = createMockAudioData();

      mockFetch = vi.fn((url, init) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/302/v2/audio/tts')) {
          capturedRequest = { url: urlStr, init: init ?? {} };
          return Promise.resolve(
            new Response(JSON.stringify(createSyncTTSResponse(audioUrl)), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(
          new Response(audioData.buffer as ArrayBuffer, {
            status: 200,
            headers: { 'content-type': 'audio/mpeg' },
          }),
        );
      }) as FetchFunction;

      const model = createTestModel('openai/alloy');
      await model.doGenerate({ text: 'Hello' });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.provider).toBe('openai');
      expect(body.voice).toBe('alloy');
    });

    it('should parse provider/model/voice format', async () => {
      const audioUrl = 'https://file.302.ai/audio.mp3';
      const audioData = createMockAudioData();

      mockFetch = vi.fn((url, init) => {
        if (typeof url === 'string' && url.includes('/302/v2/audio/tts')) {
          capturedRequest = { url: url.toString(), init: init ?? {} };
          return Promise.resolve(
            new Response(JSON.stringify(createSyncTTSResponse(audioUrl)), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(
          new Response(audioData.buffer as ArrayBuffer, {
            status: 200,
            headers: { 'content-type': 'audio/mpeg' },
          }),
        );
      }) as FetchFunction;

      const model = createTestModel('azure/zh-CN-Neural/XiaoxiaoNeural');
      await model.doGenerate({ text: 'Hello' });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.provider).toBe('azure');
      expect(body.model).toBe('zh-CN-Neural');
      expect(body.voice).toBe('XiaoxiaoNeural');
    });
  });

  describe('doGenerate', () => {
    beforeEach(() => {
      const audioUrl = 'https://file.302.ai/audio.mp3';
      const audioData = createMockAudioData();

      mockFetch = vi.fn((url, init) => {
        if (typeof url === 'string' && url.includes('/302/v2/audio/tts')) {
          capturedRequest = { url: url.toString(), init: init ?? {} };
          return Promise.resolve(
            new Response(JSON.stringify(createSyncTTSResponse(audioUrl)), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }
        // Audio download
        return Promise.resolve(
          new Response(audioData.buffer as ArrayBuffer, {
            status: 200,
            headers: { 'content-type': 'audio/mpeg' },
          }),
        );
      }) as FetchFunction;
    });

    it('should call TTS API with correct URL', async () => {
      const model = createTestModel('openai/alloy');
      await model.doGenerate({ text: 'Hello, world!' });

      expect(capturedRequest?.url).toContain('/302/v2/audio/tts');
    });

    it('should include Authorization header', async () => {
      const model = createTestModel('openai/alloy');
      await model.doGenerate({ text: 'Hello' });

      expect(capturedRequest?.init.headers).toBeDefined();
      const headers = capturedRequest?.init.headers as Record<string, string>;
      expect(headers['authorization']).toBe('Bearer test-token');
    });

    it('should include text in request body', async () => {
      const model = createTestModel('openai/alloy');
      await model.doGenerate({ text: 'Hello, world!' });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.text).toBe('Hello, world!');
    });

    it('should include provider and voice from modelId', async () => {
      const model = createTestModel('elevenlabs/rachel');
      await model.doGenerate({ text: 'Hello' });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.provider).toBe('elevenlabs');
      expect(body.voice).toBe('rachel');
    });

    it('should include speed when provided', async () => {
      const model = createTestModel('openai/alloy');
      await model.doGenerate({ text: 'Hello', speed: 1.5 });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.speed).toBe(1.5);
    });

    it('should include output format when provided', async () => {
      const model = createTestModel('openai/alloy');
      await model.doGenerate({ text: 'Hello', outputFormat: 'wav' });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.output_format).toBe('wav');
    });

    it('should override voice when provided in options', async () => {
      const model = createTestModel('openai/alloy');
      await model.doGenerate({ text: 'Hello', voice: 'nova' });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.voice).toBe('nova');
    });

    it('should return audio as Uint8Array', async () => {
      const model = createTestModel('openai/alloy');
      const result = await model.doGenerate({ text: 'Hello' });

      expect(result.audio).toBeInstanceOf(Uint8Array);
      expect(result.audio.length).toBeGreaterThan(0);
    });

    it('should return response metadata', async () => {
      const model = createTestModel('openai/alloy');
      const result = await model.doGenerate({ text: 'Hello' });

      expect(result.response).toBeDefined();
      expect(result.response.modelId).toBe('openai/alloy');
      expect(result.response.timestamp).toBeInstanceOf(Date);
    });

    it('should include request body in result', async () => {
      const model = createTestModel('openai/alloy');
      const result = await model.doGenerate({ text: 'Hello' });

      expect(result.request?.body).toBeDefined();
      const requestBody = JSON.parse(result.request!.body as string);
      expect(requestBody.text).toBe('Hello');
    });
  });

  describe('async mode', () => {
    it('should add run_async query param when enabled', async () => {
      const audioUrl = 'https://file.302.ai/audio.mp3';
      const audioData = createMockAudioData();
      const taskId = 'async_task_123';

      mockFetch = vi.fn((url, init) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (urlStr.includes('/302/v2/audio/tts')) {
          capturedRequest = { url: urlStr, init: init ?? {} };
          // Return pending for async mode
          return Promise.resolve(
            new Response(JSON.stringify(createAsyncTTSResponse(taskId)), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }

        if (urlStr.includes('/302/v2/audio/fetch/')) {
          // Return completed status
          return Promise.resolve(
            new Response(
              JSON.stringify(
                createTaskStatusResponse(taskId, 'completed', audioUrl),
              ),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              },
            ),
          );
        }

        // Audio download
        return Promise.resolve(
          new Response(audioData.buffer as ArrayBuffer, {
            status: 200,
            headers: { 'content-type': 'audio/mpeg' },
          }),
        );
      }) as FetchFunction;

      const model = createTestModel('openai/alloy');
      await model.doGenerate({
        text: 'Hello',
        providerOptions: {
          ai302: { runAsync: true, pollInterval: 10, maxPollAttempts: 3 },
        },
      });

      expect(capturedRequest?.url).toContain('run_async=true');
    });

    it('should poll for async task completion', async () => {
      const audioUrl = 'https://file.302.ai/audio.mp3';
      const audioData = createMockAudioData();
      const taskId = 'async_task_456';
      let pollCount = 0;

      mockFetch = vi.fn((url, init) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (urlStr.includes('/302/v2/audio/tts')) {
          capturedRequest = { url: urlStr, init: init ?? {} };
          return Promise.resolve(
            new Response(JSON.stringify(createAsyncTTSResponse(taskId)), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }

        if (urlStr.includes('/302/v2/audio/fetch/')) {
          pollCount++;
          // Complete after 2 polls
          const status = pollCount >= 2 ? 'completed' : 'processing';
          return Promise.resolve(
            new Response(
              JSON.stringify(
                createTaskStatusResponse(
                  taskId,
                  status as 'completed' | 'processing',
                  status === 'completed' ? audioUrl : undefined,
                ),
              ),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              },
            ),
          );
        }

        return Promise.resolve(
          new Response(audioData.buffer as ArrayBuffer, {
            status: 200,
            headers: { 'content-type': 'audio/mpeg' },
          }),
        );
      }) as FetchFunction;

      const model = createTestModel('openai/alloy');
      const result = await model.doGenerate({
        text: 'Long text that needs async processing',
        providerOptions: {
          ai302: { runAsync: true, pollInterval: 10, maxPollAttempts: 5 },
        },
      });

      expect(pollCount).toBe(2);
      expect(result.audio).toBeInstanceOf(Uint8Array);
    });
  });

  describe('provider options', () => {
    beforeEach(() => {
      const audioUrl = 'https://file.302.ai/audio.mp3';
      const audioData = createMockAudioData();

      mockFetch = vi.fn((url, init) => {
        if (typeof url === 'string' && url.includes('/302/v2/audio/tts')) {
          capturedRequest = { url: url.toString(), init: init ?? {} };
          return Promise.resolve(
            new Response(JSON.stringify(createSyncTTSResponse(audioUrl)), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(
          new Response(audioData.buffer as ArrayBuffer, {
            status: 200,
            headers: { 'content-type': 'audio/mpeg' },
          }),
        );
      }) as FetchFunction;
    });

    it('should include model from provider options', async () => {
      const model = createTestModel('doubao/default');
      await model.doGenerate({
        text: 'Hello',
        providerOptions: {
          ai302: { model: 'doubao-tts-v1' },
        },
      });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.model).toBe('doubao-tts-v1');
    });

    it('should include volume from provider options', async () => {
      const model = createTestModel('openai/alloy');
      await model.doGenerate({
        text: 'Hello',
        providerOptions: {
          ai302: { volume: 0.8 },
        },
      });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.volume).toBe(0.8);
    });

    it('should include emotion from provider options', async () => {
      const model = createTestModel('azure/zh-CN-XiaoxiaoNeural');
      await model.doGenerate({
        text: 'Hello',
        providerOptions: {
          ai302: { emotion: 'cheerful' },
        },
      });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.emotion).toBe('cheerful');
    });

    it('should include timeout from provider options', async () => {
      const model = createTestModel('openai/alloy');
      await model.doGenerate({
        text: 'Long text...',
        providerOptions: {
          ai302: { timeout: 300 },
        },
      });

      const body = JSON.parse(capturedRequest?.init.body as string);
      expect(body.timeout).toBe(300);
    });

    it('should include webhook in query params', async () => {
      const model = createTestModel('openai/alloy');
      await model.doGenerate({
        text: 'Hello',
        providerOptions: {
          ai302: { webhook: 'https://example.com/webhook' },
        },
      });

      expect(capturedRequest?.url).toContain(
        'webhook=https%3A%2F%2Fexample.com%2Fwebhook',
      );
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid modelId format', async () => {
      const model = createTestModel('invalid');

      await expect(model.doGenerate({ text: 'Hello' })).rejects.toThrow(
        'Invalid speech model ID format',
      );
    });

    it('should throw error when TTS request fails', async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: { message: 'API Error' } }),
            { status: 400, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ) as FetchFunction;

      const model = createTestModel('openai/alloy');
      await expect(model.doGenerate({ text: 'Hello' })).rejects.toThrow();
    });

    it('should throw error when task fails in async mode', async () => {
      const taskId = 'failed_task';

      mockFetch = vi.fn((url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (urlStr.includes('/302/v2/audio/tts')) {
          return Promise.resolve(
            new Response(JSON.stringify(createAsyncTTSResponse(taskId)), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }

        if (urlStr.includes('/302/v2/audio/fetch/')) {
          return Promise.resolve(
            new Response(
              JSON.stringify(createTaskStatusResponse(taskId, 'failed')),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              },
            ),
          );
        }

        return Promise.reject(new Error('Unexpected request'));
      }) as FetchFunction;

      const model = createTestModel('openai/alloy');
      await expect(
        model.doGenerate({
          text: 'Hello',
          providerOptions: {
            ai302: { runAsync: true, pollInterval: 10, maxPollAttempts: 2 },
          },
        }),
      ).rejects.toThrow('TTS task failed');
    });
  });
});

