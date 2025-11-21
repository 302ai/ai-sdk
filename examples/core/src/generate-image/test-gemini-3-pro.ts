import 'dotenv/config';
import { createAI302 } from '@302ai/ai-sdk';
import { experimental_generateImage as generateImage } from 'ai';
import fs from 'fs';
import path from 'path';

const model = createAI302({
  baseURL: 'https://api.302.ai',
});

async function testGemini3Pro() {
  console.log('Testing gemini-3-pro-image-preview model...');

  const outputDir = path.join('model_test_results', 'gemini-3-pro-image-preview');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Test with different aspect ratios
    const aspectRatios = ['1:1', '3:4', '16:9', '4:3'];

    for (const aspectRatio of aspectRatios) {
      console.log(`\nTesting aspect ratio: ${aspectRatio}`);

      const result = await generateImage({
        model: model.image('gemini-3-pro-image-preview'),
        prompt: 'A 3d rendered image of a pig with wings and a top hat flying over a happy futuristic scifi city with lots of greenery',
        aspectRatio: aspectRatio as `${number}:${number}`,
      });

      if (result.warnings.length > 0) {
        console.log(`Warnings:`, result.warnings);
      }

      for (const [index, image] of result.images.entries()) {
        const filename = path.join(outputDir, `image-${aspectRatio.replace(':', 'x')}-${index}.png`);
        fs.writeFileSync(filename, image.uint8Array);
        console.log(`✅ Image saved to ${filename}`);
      }
    }

    console.log('\n✅ All tests passed for gemini-3-pro-image-preview!');
  } catch (error) {
    console.error('❌ Error testing gemini-3-pro-image-preview:', error);
    throw error;
  }
}

testGemini3Pro().catch(console.error);

