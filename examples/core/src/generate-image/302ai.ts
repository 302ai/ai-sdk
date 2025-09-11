import 'dotenv/config';
import { createAI302 } from '@302ai/ai-sdk';
import { experimental_generateImage as generateImage } from 'ai';
import fs from 'fs';
import path from 'path';

const model = createAI302({
  baseURL: 'https://api.302.ai',
});

const MODELS = [
  'flux-v1.1-ultra',
  'flux-pro-v1.1',
  'flux-pro',
  'flux-dev',
  'flux-schnell',
  'ideogram/V_1',
  'ideogram/V_1_TURBO',
  'ideogram/V_2',
  'ideogram/V_2_TURBO',
  'ideogram/V_2A',
  'ideogram/V_2A_TURBO',
  'dall-e-3',
  'recraftv3',
  'recraftv2',
  'sdxl-lightning',
  'sdxl-lightning-v2',
  'sdxl-lightning-v3',
  'kolors',
  'aura-flow',
  'photon-1',
  'photon-flash-1',
  'sdxl',
  'sd3-ultra',
  'sd3v2',
  'sd3.5-large',
  'sd3.5-large-turbo',
  'sd3.5-medium',
  'midjourney/6.0',
  'midjourney/6.1',
  'midjourney/7.0',
  'nijijourney/6.0',
  'google-imagen-3',
  'google-imagen-3-fast',
  'google-imagen-4-preview',
  'doubao-general-v2.1-l',
  'doubao-general-v2.0-l',
  'doubao-general-v2.0',
  'doubao-general-v3.0',
  'lumina-image-v2',
  'omnigen-v1',
  'playground-v25',
  'cogview-4',
  'cogview-4-250304',
  'minimaxi-image-01',
  'irag-1.0',
  'hidream-i1-full',
  'hidream-i1-dev',
  'hidream-i1-fast',
  'gpt-image-1',
  'ideogram/V_3_DEFAULT',
  'ideogram/V_3_TURBO',
  'ideogram/V_3_QUALITY',
  'bagel',
  'soul',
  'flux-kontext-max',
  'flux-kontext-pro',
  'kling-v1',
  'kling-v1-5',
  'kling-v2',
  'kling-v2-1',
  'flux-1-krea',
  'doubao-seedream-3-0-t2i-250415',
  'qwen-image',
  'gemini-2.5-flash-image-preview',
  'doubao-seedream-4-0-250828',
];

const TEST_PROMPT = 'A burrito launched through a tunnel';
const OUTPUT_DIR = 'model_test_results';

async function testModel(modelId: string) {
  console.log(`Testing model: ${modelId}`);
  const modelDir = path.join(OUTPUT_DIR, modelId.replace('/', '_'));

  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  try {
    const result = await generateImage({
      model: model.image(modelId),
      prompt: TEST_PROMPT,
      aspectRatio: '3:4',
      seed: 0,
      n: 2,
    });

    if (result.warnings.length > 0) {
      console.log(`Warnings for ${modelId}:`, result.warnings);
    }

    for (const [index, image] of result.images.entries()) {
      const filename = path.join(modelDir, `image-${index}.png`);
      fs.writeFileSync(filename, image.uint8Array);
      console.log(`Image saved to ${filename}`);
    }
    console.log(`✅ Successfully tested ${modelId}`);
  } catch (error) {
    console.error(`❌ Error testing ${modelId}:`, error);
  }
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  for (const modelId of MODELS) {
    await testModel(modelId);
    // Add a small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

main().catch(console.error);
