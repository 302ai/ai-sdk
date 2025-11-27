# 302 AI SDK

This is an official provider SDK for [302AI](https://302.ai) that integrates with [Vercel AI SDK](https://sdk.vercel.ai).

## Overview

The 302AI provider enables seamless integration with the Vercel AI SDK, offering access to a wide range of AI models for:

### Text Generation
- Advanced language models including:
  - GPT-4 series (gpt-4-turbo, gpt-4o, etc.)
  - Claude-3 series (opus, sonnet, haiku)
  - Gemini series
  - Llama 3 series
  - And many other leading models

### Image Generation
- State-of-the-art image models including:
  - Midjourney 6.0/6.1/7.0
  - DALL-E 3
  - Stable Diffusion variants (SD3, SDXL)
  - Flux models
  - Ideogram models
  - Playground models
  - Omnigen models
  - And more specialized image generators

### Embeddings
- High-quality embedding models including:
  - OpenAI text-embedding-3 (small/large)
  - BGE models
  - Zhipu embeddings
  - And other specialized embedding models

### Speech (TTS)
- Text-to-Speech with 10+ providers:
  - OpenAI (alloy, nova, shimmer, etc.)
  - Azure Cognitive Services
  - ElevenLabs
  - Doubao (ByteDance)
  - Google Cloud TTS
  - Qwen (Alibaba)
  - And more specialized TTS providers
- Features:
  - Sync and async modes
  - Customizable speed, volume, emotion
  - Multiple output formats (mp3, wav, ogg)

All models are accessible through a unified, type-safe API that follows Vercel AI SDK standards. For a complete list of supported models, please refer to our [detailed documentation](/packages/ai/README.md).

## Features
- 🚀 Simple, unified API for all AI operations
- 💪 Full TypeScript support
- 🔄 Streaming responses support
- 🛡️ Built-in error handling
- 📝 Comprehensive documentation

## Installation

```bash
npm install @302ai/ai-sdk
```

## Quick Start

```typescript
import { ai302 } from '@302ai/ai-sdk';
import { generateText } from 'ai';

// Text Generation
const { text } = await generateText({
  model: ai302('gpt-4-turbo'),
  prompt: 'Hello, how can I help you today?'
});

// Image Generation
import { experimental_generateImage as generateImage } from 'ai';

const { image } = await generateImage({
  model: ai302.image('midjourney/6.1'),
  prompt: 'A beautiful sunset over mountains'
});

// Embeddings
import { embed } from 'ai';

const { embedding } = await embed({
  model: ai302.textEmbeddingModel('text-embedding-3-large'),
  value: 'Text to embed'
});

// Speech (TTS)
import { generateSpeech } from 'ai';
import fs from 'fs';

const { audio } = await generateSpeech({
  model: ai302.speech('openai/alloy'),
  text: 'Hello, welcome to 302AI!'
});

fs.writeFileSync('speech.mp3', audio.uint8Array);
```

## What's inside?

This SDK includes the following packages:

### Packages

- `ai`: The [@302ai/ai-sdk](/packages/ai/README.md) Core SDK for 302AI.

Each package is 100% [TypeScript](https://www.typescriptlang.org/).

## Documentation

For detailed documentation about available models and usage, please check:

- [302AI Provider Documentation](/packages/ai/README.md)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)

## License

Apache License 2.0 - See [LICENSE](./LICENSE) for details.
