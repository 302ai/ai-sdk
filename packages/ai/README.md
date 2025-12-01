# AI SDK - 302AI Provider

The **[302AI provider](https://sdk.vercel.ai/providers/ai-sdk-providers/)** for the [AI SDK](https://sdk.vercel.ai/docs) contains image model support for the [302AI](https://302.ai) platform.

## Setup

The 302AI provider is available in the `@302ai/ai-sdk` module. You can install it with

```bash
npm i @302ai/ai-sdk
```

## Provider Instance

You can import the default provider instance `ai302` from `@302ai/ai-sdk`:

```ts
import { ai302 } from '@302ai/ai-sdk';
```

## Language Model Example

```ts
import { ai302 } from '@302ai/ai-sdk';
import { generateText } from 'ai';

const { text } = await generateText({
  model: ai302('gpt-4o'),
  prompt: 'Write a JavaScript function that sorts a list:',
});
```

### Language Models
> Check out the [302AI API docs](https://302ai.apifox.cn/api-147522038) for more information.


## Embedding Model Example

```ts
import { ai302 } from '@302ai/ai-sdk';
import { embed } from 'ai';

const { embedding, usage } = await embed({
  model: ai302.textEmbeddingModel('BAAI/bge-large-en-v1.5'),
  value: 'sunny day at the beach',
});
```

### Embedding Models
> Check out the [302AI API docs](https://302ai.apifox.cn/api-147522048) for more information.
- `text-embedding-3-small`
- `text-embedding-3-large`
- `text-embedding-ada-002`
- `zhipu-embedding-2`
- `BAAI/bge-large-en-v1.5`
- `BAAI/bge-large-zh-v1.5`
- `BAAI/bge-m3`
- `Baichuan-Text-Embedding`
- `bce-embedding-base_v1`

## Image Model Examples

```ts
import { ai302 } from '@302ai/ai-sdk';
import { experimental_generateImage as generateImage } from 'ai';
import fs from 'fs';

const { image } = await generateImage({
  model: ai302.image('midjourney/6.1'),
  prompt: 'A serene mountain landscape at sunset',
});
const filename = `image-${Date.now()}.png`;
fs.writeFileSync(filename, image.uint8Array);
console.log(`Image saved to ${filename}`);
```

### Image Models
> Check out the [302AI API docs](https://www.kdocs.cn/l/ctevU0zBlQlF) for more information.

## Speech (TTS) Model Example

```ts
import { ai302 } from '@302ai/ai-sdk';
import { generateSpeech } from 'ai';
import fs from 'fs';

const { audio } = await generateSpeech({
  model: ai302.speech('openai/alloy'),
  text: 'Hello, welcome to 302AI!',
});

fs.writeFileSync('speech.mp3', audio.uint8Array);
```

### Advanced Usage with Options

```ts
// With speed and output format
const { audio } = await generateSpeech({
  model: ai302.speech('openai/nova'),
  text: 'Hello world!',
  speed: 1.2,
  providerOptions: {
    ai302: {
      volume: 0.8,
      outputFormat: 'mp3',
    },
  },
});

// Azure TTS with emotion
const { audio } = await generateSpeech({
  model: ai302.speech('azure/zh-CN-XiaoxiaoNeural'),
  text: '你好，欢迎使用302AI！',
  providerOptions: {
    ai302: {
      emotion: 'cheerful',
    },
  },
});

// Async mode for long text
const { audio } = await generateSpeech({
  model: ai302.speech('elevenlabs/Rachel'),
  text: longText,
  providerOptions: {
    ai302: {
      runAsync: true,
      pollInterval: 3000,
      timeout: 300,
    },
  },
});
```

### Speech Providers

302AI supports multiple TTS providers through a unified API. The model ID format is `provider/voice`:

| Provider | Example Model ID | Description |
|----------|------------------|-------------|
| `openai` | `openai/alloy`, `openai/nova`, `openai/shimmer` | OpenAI TTS voices |
| `azure` | `azure/zh-CN-XiaoxiaoNeural`, `azure/en-US-JennyNeural` | Azure Cognitive Services |
| `elevenlabs` | `elevenlabs/Rachel`, `elevenlabs/Adam` | ElevenLabs voices |
| `doubao` | `doubao/zh_female_qingxin` | ByteDance Doubao TTS |
| `fish` | `fish/zh-CN-XiaoxiaoNeural` | Fish Audio TTS |
| `minimaxi` | `minimaxi/male-qn-qingse` | MiniMax TTS |
| `google` | `google/en-US-Wavenet-A` | Google Cloud TTS |
| `qwen` | `qwen/Cherry` | Alibaba Qwen TTS |
| `meruka` | `meruka/default` | Meruka TTS |
| `dubbingx` | `dubbingx/en-US-male` | DubbingX TTS |

### Speech Options

| Option | Type | Description |
|--------|------|-------------|
| `speed` | `number` | Speech speed (0.25-4.0, default: 1.0) |
| `volume` | `number` | Volume level (0-2, default: 1.0) |
| `emotion` | `string` | Emotion style (provider-specific) |
| `outputFormat` | `string` | Output format: `mp3`, `wav`, `ogg`, etc. |
| `runAsync` | `boolean` | Enable async mode for long text |
| `webhook` | `string` | Webhook URL for async notifications |
| `timeout` | `number` | Request timeout in seconds (default: 180) |
| `pollInterval` | `number` | Poll interval in ms for async mode (default: 2000) |
| `maxPollAttempts` | `number` | Max poll attempts for async mode (default: 90) |

> Check out the [302AI TTS API docs](https://302ai.apifox.cn) for more information.

## Reranking Model Example

Reranking improves search relevance by reordering documents based on their relevance to a query.

```ts
import { ai302 } from '@302ai/ai-sdk';
import { rerank } from 'ai';

const documents = [
  'Organic skincare for sensitive skin with aloe vera',
  'New makeup trends focus on bold colors',
  'Bio-Hautpflege für empfindliche Haut mit Aloe Vera',
];

const { ranking, rerankedDocuments } = await rerank({
  model: ai302.reranking('jina-reranker-v2-base-multilingual'),
  documents,
  query: 'skincare products for sensitive skin',
  topN: 2,
});

console.log(ranking);
// [
//   { index: 0, relevanceScore: 0.95 },
//   { index: 2, relevanceScore: 0.78 }
// ]
```

### Reranking with Object Documents

```ts
const documents = [
  { title: 'Skincare Guide', content: 'Organic products for sensitive skin...' },
  { title: 'Makeup Trends', content: 'Bold colors and techniques...' },
];

const { ranking } = await rerank({
  model: ai302.reranking('bge-reranker-v2-m3'),
  documents,
  query: 'sensitive skin care',
  topN: 1,
});
```

### Reranking Models

| Provider | Model ID | Description |
|----------|----------|-------------|
| Jina | `jina-reranker-v2-base-multilingual` | Multilingual reranker |
| Jina | `jina-reranker-v1-base-en` | English reranker |
| Jina | `jina-reranker-v1-turbo-en` | Fast English reranker |
| Jina | `jina-colbert-v1-en` | ColBERT-based reranker |
| BAAI | `bge-reranker-v2-m3` | BGE multilingual reranker |
| BCE | `bce-reranker-base_v1` | BCE reranker |
| Qwen | `Qwen/Qwen3-Reranker-8B` | Qwen 8B reranker |
| Qwen | `Qwen/Qwen3-Reranker-4B` | Qwen 4B reranker |
| Qwen | `Qwen/Qwen3-Reranker-0.6B` | Qwen 0.6B reranker |
| Voyage | `rerank-2.5` | Voyage reranker |
| Voyage | `rerank-2.5-lite` | Voyage lite reranker |

> Check out the [302AI Rerank API docs](https://302ai.apifox.cn) for more information.

## Documentation

Please check out the **[Vercel AI SDK](https://sdk.vercel.ai/providers/ai-sdk-providers)** for more information.
