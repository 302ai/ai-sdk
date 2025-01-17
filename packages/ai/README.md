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
> Check out the [302AI API docs](https://302ai.apifox.cn/api-147522046) for more information.

- `flux-v1.1-ultra`
- `flux-pro-v1.1`
- `flux-pro`
- `flux-dev`
- `flux-schnell`
- `ideogram/V_1`
- `ideogram/V_1_TURBO`
- `ideogram/V_2`
- `ideogram/V_2_TURBO`
- `dall-e-3`
- `recraftv3`
- `recraftv2`
- `sdxl-lightning-v2`
- `kolors`
- `aura-flow`
- `photon-1`
- `photon-flash-1`
- `sdxl`
- `sd3-ultra`
- `sd3v2`
- `sd3.5-large`
- `sd3.5-large-turbo`
- `sd3.5-medium`
- `midjourney/6.1`
- `midjourney/6.0`
- `nijijourney/6.0`

## Documentation

Please check out the **[Vercel AI SDK](https://sdk.vercel.ai/providers/ai-sdk-providers)** for more information.
