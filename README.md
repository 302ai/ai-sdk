# <p align="center"> 🤖 302 AI SDK </p>

<p align="center"> This is the official provider SDK for <a href="https://302.ai">302AI</a> based on the <a href="https://v6.ai-sdk.dev/docs/introduction"><strong>v6 (Beta)</strong></a> version, integrated with the <a href="https://sdk.vercel.ai">Vercel AI SDK</a>. </p>

## 📋 Overview

The 302AI provider enables seamless integration with the Vercel AI SDK, offering access to a wide range of AI models for:

### 💬 Text Generation
- Advanced language models including:
  - GPT 5.1 series (gpt-5.1-plus, gpt-5.1-codex, etc.)
  - Claude 4-5 series (opus, sonnet, haiku)
  - Gemini series
  - Llama 3 series
  - And many other leading models

### 🎨 Image Generation
- State-of-the-art image models including:
  - Midjourney 6.0/6.1/7.0
  - GPT-Image-1
  - Stable Diffusion variants (SD3, SDXL)
  - Flux models
  - Ideogram models
  - Qwen models
  - Doubao models (Seedream 3.0/4.0)
  - Gemini-2.5-flash-image (Nano-banana)、Gemini-3-pro-image-preview (Nano-banana-pro)
  - And more specialized image generators

### 🔢 Embeddings
- High-quality embedding models including:
  - OpenAI text-embedding-3 (small/large)
  - BGE models
  - Zhipu embeddings
  - And other specialized embedding models

### 🔊Speech (TTS)
- Text-to-Speech with 10+ providers:
  - OpenAI (alloy, nova, shimmer, etc.)
  - Azure Cognitive Services
  - ElevenLabs
  - Doubao (ByteDance)
  - Google Cloud TTS
  - Qwen (Alibaba)
  - And more specialized TTS providers
- Features:
  - ⚡ Sync and async modes
  - 🎚️ Customizable speed, volume, emotion
  - 📦 Multiple output formats (mp3, wav, ogg)

All models are accessible through a unified, type-safe API that follows Vercel AI SDK standards. For a complete list of supported models, please refer to our [detailed documentation](/packages/ai/README.md).

## ✨ Features
- 🚀 Simple, unified API for all AI operations
- 💪 Full TypeScript support
- 🔄 Streaming responses support
- 🛡️ Built-in error handling
- 📝 Comprehensive documentation

## 📦 Installation

```bash
npm install @302ai/ai-sdk
```

## 🚀 Quick Start

### 💬 Text Generation

```typescript
import { ai302 } from '@302ai/ai-sdk';
import { generateText } from 'ai';

// Generate text using GPT-4 Turbo
const { text } = await generateText({
  model: ai302('gpt-4-turbo'),
  prompt: 'Hello, how can I help you today?'
});

console.log(text);
```

### 🎨 Image Generation

```typescript
import { experimental_generateImage as generateImage } from 'ai';

// Generate image with Midjourney
const { image } = await generateImage({
  model: ai302.image('midjourney/6.1'),
  prompt: 'A beautiful sunset over mountains'
});
```

### 🔢 Embeddings

```typescript
import { embed } from 'ai';

// Generate text embeddings
const { embedding } = await embed({
  model: ai302.textEmbeddingModel('text-embedding-3-large'),
  value: 'Text to embed'
});

console.log(embedding);
```

### 🔊 Speech (TTS)

```typescript
import { generateSpeech } from 'ai';
import fs from 'fs';

// Generate speech file
const { audio } = await generateSpeech({
  model: ai302.speech('openai/alloy'),
  text: 'Hello, welcome to 302AI!'
});

fs.writeFileSync('speech.mp3', audio.uint8Array);
```

## 📚 What's inside?

This SDK includes the following packages:

### 📦 Packages

| Package Name | Description |
|--------------|-------------|
| [@302ai/ai-sdk](/packages/ai/README.md) | 302AI core SDK providing access to all AI models |

> 💡 Each package is 100% [TypeScript](https://www.typescriptlang.org/) and provides full type support.

## 📖 Documentation

For detailed documentation about available models and usage, please check:

- 📘 [302AI Provider Documentation](/packages/ai/README.md)
- 📗 [Vercel AI SDK Documentation](https://v6.ai-sdk.dev/docs/introduction)

## 📄 License

Apache License 2.0 - See [LICENSE](./LICENSE) for details.
