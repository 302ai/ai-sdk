import { ai302 } from '@302ai/ai-sdk';
import { generateText, streamText } from 'ai';
import 'dotenv/config';

async function testGenerateText() {
  console.log('=== Testing generateText ===');
  const { text, usage } = await generateText({
    model: ai302('gpt-4o'),
    prompt: 'What is the capital of France?',
  });

  console.log('Response:', text);
  console.log('Usage:', usage);
}

async function testStreamText() {
  console.log('\n=== Testing streamText ===');
  const { usage, fullStream } = streamText({
    model: ai302('gemini-3-pro-preview'),
    prompt: 'Count from 1 to 5 slowly.',
  });

  process.stdout.write('Response: ');
  for await (const chunk of fullStream) {
    process.stdout.write(JSON.stringify(chunk));
  }
  console.log('\nUsage:', await usage);
}

async function main() {
  await testGenerateText();
  await testStreamText();
}

main().catch(console.error);
