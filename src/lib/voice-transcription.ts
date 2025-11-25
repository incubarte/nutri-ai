/**
 * Voice transcription service with cloud and local support
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

const execAsync = promisify(exec);

export type TranscriptionMode = 'auto' | 'cloud' | 'local';

interface TranscriptionResult {
  text: string;
  method: 'cloud' | 'local';
}

/**
 * Transcribe audio using Groq Cloud API (fast, free, requires internet)
 */
async function transcribeWithGroq(
  audioPath: string,
  prompt: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  try {
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'es');
    formData.append('temperature', '0');
    formData.append('prompt', prompt);

    // Call Groq API using axios
    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders(),
        },
      }
    );

    return response.data.text?.trim() || '';

  } catch (error: any) {
    console.error('[Groq] Transcription failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Transcribe audio using local Whisper model
 */
async function transcribeWithLocalWhisper(
  audioPath: string,
  prompt: string
): Promise<string> {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'whisper-transcribe.py');
    const pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python3');

    // Escape quotes in prompt for shell
    const escapedPrompt = prompt.replace(/"/g, '\\"');

    const { stdout, stderr } = await execAsync(
      `${pythonPath} ${scriptPath} ${audioPath} "${escapedPrompt}"`
    );

    if (stderr && !stderr.includes('FP16')) {
      console.error('[Local Whisper] stderr:', stderr);
    }

    return stdout.trim();

  } catch (error) {
    console.error('[Local Whisper] Transcription failed:', error);
    throw error;
  }
}

/**
 * Transcribe audio using the best available method
 */
export async function transcribeAudio(
  audioPath: string,
  prompt: string,
  mode?: TranscriptionMode
): Promise<TranscriptionResult> {
  const transcriptionMode = mode || (process.env.VOICE_TRANSCRIPTION_MODE as TranscriptionMode) || 'auto';

  // Cloud only mode
  if (transcriptionMode === 'cloud') {
    const text = await transcribeWithGroq(audioPath, prompt);
    return { text, method: 'cloud' };
  }

  // Local only mode
  if (transcriptionMode === 'local') {
    const text = await transcribeWithLocalWhisper(audioPath, prompt);
    return { text, method: 'local' };
  }

  // Auto mode - try cloud first, fallback to local
  if (process.env.GROQ_API_KEY) {
    try {
      console.log('[Voice] Attempting cloud transcription (Groq)...');
      const text = await transcribeWithGroq(audioPath, prompt);
      console.log('[Voice] ✓ Cloud transcription successful');
      return { text, method: 'cloud' };
    } catch (error) {
      console.warn('[Voice] Cloud transcription failed, falling back to local...');
    }
  }

  // Fallback to local
  console.log('[Voice] Using local Whisper transcription...');
  const text = await transcribeWithLocalWhisper(audioPath, prompt);
  return { text, method: 'local' };
}
