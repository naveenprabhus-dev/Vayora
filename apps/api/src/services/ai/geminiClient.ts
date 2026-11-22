import { GoogleGenAI } from '@google/genai';
import type { AppConfig } from '../../config/env.ts';
import { ServiceUnavailableError } from '../../utils/errors.ts';

export interface GeminiClientStatus {
  readonly configured: boolean;
  readonly model: string;
}

/**
 * Server-side Gemini SDK factory.
 * API keys are strictly isolated on the backend and never exposed to browsers.
 */
export function createGeminiClient(config: AppConfig): GoogleGenAI {
  const key = config.geminiApiKey.trim();
  if (!key || key.startsWith('REPLACE_WITH')) {
    throw new ServiceUnavailableError('Server-side Gemini API key is not configured.');
  }

  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function getGeminiStatus(config: AppConfig): GeminiClientStatus {
  const key = config.geminiApiKey.trim();
  return {
    configured: key.length > 0 && !key.startsWith('REPLACE_WITH'),
    model: config.geminiModelPrimary,
  };
}
