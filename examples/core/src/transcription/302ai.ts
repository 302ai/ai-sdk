import { ai302 } from '@302ai/ai-sdk';
import { experimental_transcribe as transcribe } from 'ai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AUDIO_FILE = join(__dirname, 'audio-sample.mp3');

/**
 * Basic transcription example using whisper-1
 */
async function testBasicTranscription() {
  console.log('=== Testing Basic Transcription (whisper-1) ===');

  // Read audio file
  const audioBuffer = readFileSync(AUDIO_FILE);

  const result = await transcribe({
    model: ai302.transcription('whisper-1'),
    audio: audioBuffer,
  });

  console.log('Text:', result.text);
  console.log('Language:', result.language);
  console.log('Duration:', result.durationInSeconds, 'seconds');
  console.log('Segments:', result.segments.length);
}

/**
 * Transcription with verbose JSON format (includes segments)
 */
async function testVerboseTranscription() {
  console.log('\n=== Testing Verbose Transcription ===');

  const audioBuffer = readFileSync(AUDIO_FILE);

  const result = await transcribe({
    model: ai302.transcription('whisper-1'),
    audio: audioBuffer,
    providerOptions: {
      ai302: {
        responseFormat: 'verbose_json',
        language: 'zh', // Chinese
        timestampGranularities: ['segment', 'word'],
      },
    },
  });

  console.log('Text:', result.text);
  console.log('Segments:');
  result.segments.slice(0, 5).forEach((segment, i) => {
    console.log(
      `  ${i + 1}. [${segment.startSecond}s - ${segment.endSecond}s] ${segment.text}`,
    );
  });
  if (result.segments.length > 5) {
    console.log(`  ... and ${result.segments.length - 5} more segments`);
  }
}

/**
 * Transcription with SRT subtitle format
 */
async function testSRTTranscription() {
  console.log('\n=== Testing SRT Subtitle Transcription ===');

  const audioBuffer = readFileSync(AUDIO_FILE);

  const result = await transcribe({
    model: ai302.transcription('whisper-1'),
    audio: audioBuffer,
    providerOptions: {
      ai302: {
        responseFormat: 'srt',
      },
    },
  });

  console.log('SRT Content (first 500 chars):');
  console.log(result.text.substring(0, 500));
}

/**
 * Transcription with VTT subtitle format
 */
async function testVTTTranscription() {
  console.log('\n=== Testing VTT Subtitle Transcription ===');

  const audioBuffer = readFileSync(AUDIO_FILE);

  const result = await transcribe({
    model: ai302.transcription('whisper-1'),
    audio: audioBuffer,
    providerOptions: {
      ai302: {
        responseFormat: 'vtt',
      },
    },
  });

  console.log('VTT Content (first 500 chars):');
  console.log(result.text.substring(0, 500));
}

/**
 * Transcription with GPT-4o transcribe model
 */
async function testGPT4oTranscription() {
  console.log('\n=== Testing GPT-4o Transcribe ===');

  const audioBuffer = readFileSync(AUDIO_FILE);

  const result = await transcribe({
    model: ai302.transcription('gpt-4o-transcribe'),
    audio: audioBuffer,
    providerOptions: {
      ai302: {
        // gpt-4o-transcribe only supports json format
        responseFormat: 'json',
      },
    },
  });

  console.log('Text:', result.text);
}

/**
 * Transcription with speaker diarization (GPT-4o-transcribe-diarize)
 */
async function testDiarizedTranscription() {
  console.log('\n=== Testing Diarized Transcription (Speaker Detection) ===');

  const audioBuffer = readFileSync(AUDIO_FILE);

  const result = await transcribe({
    model: ai302.transcription('gpt-4o-transcribe-diarize'),
    audio: audioBuffer,
    providerOptions: {
      ai302: {
        responseFormat: 'diarized_json',
      },
    },
  });

  console.log('Text:', result.text.substring(0, 200) + '...');
  console.log('\nSegments with speakers:');
  result.segments.slice(0, 5).forEach((segment, i) => {
    console.log(
      `  ${i + 1}. [${segment.startSecond.toFixed(2)}s - ${segment.endSecond.toFixed(2)}s] ${segment.text}`,
    );
  });
}

/**
 * Test different providers
 */
async function testDifferentProviders() {
  console.log('\n=== Testing Different Providers ===');

  const audioBuffer = readFileSync(AUDIO_FILE);

  // Test Doubao recognize
  try {
    console.log('\nTesting Doubao recognize...');
    const result = await transcribe({
      model: ai302.transcription('recognize'),
      audio: audioBuffer,
    });
    console.log('Doubao result:', result.text.substring(0, 100) + '...');
  } catch (e) {
    console.log('Doubao failed:', (e as Error).message);
  }

  // Test ElevenLabs scribe_v1
  try {
    console.log('\nTesting ElevenLabs scribe_v1...');
    const result = await transcribe({
      model: ai302.transcription('scribe_v1'),
      audio: audioBuffer,
    });
    console.log('ElevenLabs result:', result.text.substring(0, 100) + '...');
  } catch (e) {
    console.log('ElevenLabs failed:', (e as Error).message);
  }

  // Test SiliconFlow sensevoice
  try {
    console.log('\nTesting SiliconFlow sensevoice...');
    const result = await transcribe({
      model: ai302.transcription('sensevoice'),
      audio: audioBuffer,
      providerOptions: {
        ai302: {
          responseFormat: 'json', // sensevoice only supports json and text
        },
      },
    });
    console.log('SiliconFlow result:', result.text.substring(0, 100) + '...');
  } catch (e) {
    console.log('SiliconFlow failed:', (e as Error).message);
  }
}

async function main() {
  await testBasicTranscription();
  await testVerboseTranscription();
  await testSRTTranscription();
  await testVTTTranscription();
  await testGPT4oTranscription();
  await testDiarizedTranscription();
  await testDifferentProviders();
}

main().catch(console.error);
