import { ai302 } from '@302ai/ai-sdk';
import { experimental_generateSpeech as generateSpeech } from 'ai';
import { writeFileSync } from 'fs';
import 'dotenv/config';

async function testSyncTTS() {
  console.log('=== Testing Sync TTS ===');

  const { audio } = await generateSpeech({
    model: ai302.speech('openai/alloy'),
    text: '你好，世界！这是一个语音合成测试。',
  });

  // Save audio to file (audio.uint8Array contains the binary data)
  writeFileSync('output-sync.mp3', audio.uint8Array);
  console.log(`Audio saved to output-sync.mp3 (${audio.uint8Array.length} bytes)`);
}

async function testAsyncTTS() {
  console.log('\n=== Testing Async TTS (Long Text) ===');

  const longText = `
    人工智能正在改变我们的生活方式。从智能手机上的语音助手，
    到自动驾驶汽车，再到医疗诊断系统，AI 技术已经渗透到我们生活的方方面面。
    随着技术的不断进步，我们可以期待 AI 在未来带来更多令人惊叹的应用。
  `.trim();

  const { audio } = await generateSpeech({
    model: ai302.speech('openai/nova'),
    text: longText,
    speed: 1.1,
    providerOptions: {
      ai302: {
        runAsync: true,
        timeout: 300,
        pollInterval: 3000,
      },
    },
  });

  writeFileSync('output-async.mp3', audio.uint8Array);
  console.log(`Audio saved to output-async.mp3 (${audio.uint8Array.length} bytes)`);
}

async function testDifferentProviders() {
  console.log('\n=== Testing Different Providers ===');

  // Test Azure TTS
  try {
    console.log('Testing Azure TTS...');
    const { audio: azureAudio } = await generateSpeech({
      model: ai302.speech('azure/zh-CN-XiaoxiaoNeural'),
      text: '这是 Azure 语音合成测试。',
    });
    writeFileSync('output-azure.mp3', azureAudio.uint8Array);
    console.log('Azure TTS: output-azure.mp3');
  } catch (e) {
    console.log('Azure TTS failed:', (e as Error).message);
  }

  // Test ElevenLabs TTS
  try {
    console.log('Testing ElevenLabs TTS...');
    const { audio: elevenAudio } = await generateSpeech({
      model: ai302.speech('elevenlabs/21m00Tcm4TlvDq8ikWAM'),
      text: 'This is an ElevenLabs text-to-speech test.',
    });
    writeFileSync('output-elevenlabs.mp3', elevenAudio.uint8Array);
    console.log('ElevenLabs TTS: output-elevenlabs.mp3');
  } catch (e) {
    console.log('ElevenLabs TTS failed:', (e as Error).message);
  }
}

async function main() {
  await testSyncTTS();
  // Uncomment to test async mode and different providers:
  // await testAsyncTTS();
  // await testDifferentProviders();
}

main().catch(console.error);

