import { ai302 } from '@302ai/ai-sdk';
import { generateText } from 'ai';
import 'dotenv/config';

async function main() {
  const { text, usage } =
    await generateText({
      model: ai302('gpt-4o'),
      prompt: 'Invent a new holiday and describe its traditions.',
    });

  console.log(text);
  console.log();
  console.log('Usage:', usage);

}

main().catch(console.error);
