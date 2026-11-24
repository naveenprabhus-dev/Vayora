import { GoogleGenAI, ThinkingLevel, type Schema } from '@google/genai';
import type { AppConfig } from '../../config/env.ts';
import { ServiceUnavailableError } from '../../utils/errors.ts';

export interface GeminiClientStatus {
  readonly configured: boolean;
  readonly model: string;
}

export interface GeminiStructuredRequest {
  readonly systemInstruction: string;
  readonly prompt: string;
  readonly responseSchema: Schema;
  readonly timeoutMs: number;
  readonly maxAttempts?: number;
}

export interface GeminiStructuredResponse {
  readonly rawText: string;
  readonly model: string;
  readonly totalTokens: number | null;
  readonly attempts: number;
}

export interface GeminiAdvisoryClient {
  readonly model: string;
  isConfigured(): boolean;
  generateStructuredJson(request: GeminiStructuredRequest): Promise<GeminiStructuredResponse>;
}

export class GeminiTimeoutError extends Error {
  public constructor(timeoutMs: number) {
    super(`Gemini advisory generation exceeded the ${timeoutMs}ms timeout budget.`);
    this.name = 'GeminiTimeoutError';
  }
}

export class GeminiNotConfiguredError extends Error {
  public constructor() {
    super('Server-side Gemini API key is not configured.');
    this.name = 'GeminiNotConfiguredError';
  }
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

function isRetryableTransportError(error: unknown): boolean {
  if (error instanceof GeminiTimeoutError || error instanceof GeminiNotConfiguredError) {
    return false;
  }
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (
    message.includes('api key') ||
    message.includes('invalid argument') ||
    message.includes('permission denied') ||
    message.includes('400') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    return false;
  }
  return (
    message.includes('503') ||
    message.includes('502') ||
    message.includes('500') ||
    message.includes('429') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('unavailable')
  );
}

export class GoogleGenAIAdvisoryClient implements GeminiAdvisoryClient {
  private readonly config: AppConfig;
  public readonly model: string;

  public constructor(config: AppConfig) {
    this.config = config;
    this.model = config.geminiModelPrimary;
  }

  public isConfigured(): boolean {
    return getGeminiStatus(this.config).configured;
  }

  public async generateStructuredJson(
    request: GeminiStructuredRequest,
  ): Promise<GeminiStructuredResponse> {
    if (!this.isConfigured()) {
      throw new GeminiNotConfiguredError();
    }

    const ai = createGeminiClient(this.config);
    const maxAttempts = Math.min(Math.max(request.maxAttempts ?? 2, 1), 2);
    const deadlineMs = Date.now() + request.timeoutMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 50) {
        throw new GeminiTimeoutError(request.timeoutMs);
      }

      const abortController = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;

      try {
        const sdkPromise = ai.models.generateContent({
          model: this.model,
          contents: request.prompt,
          config: {
            systemInstruction: request.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: request.responseSchema,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
            abortSignal: abortController.signal,
          },
        });

        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            abortController.abort();
            reject(new GeminiTimeoutError(request.timeoutMs));
          }, remainingMs);
        });

        const response = await Promise.race([sdkPromise, timeoutPromise]);
        const rawText = response.text?.trim() ?? '';
        if (!rawText) {
          throw new Error('Gemini returned an empty response payload.');
        }

        const totalTokens =
          typeof response.usageMetadata?.totalTokenCount === 'number'
            ? response.usageMetadata.totalTokenCount
            : null;

        return {
          rawText,
          model: this.model,
          totalTokens,
          attempts: attempt,
        };
      } catch (error) {
        lastError = error;
        if (error instanceof GeminiTimeoutError || attempt >= maxAttempts) {
          throw error;
        }
        if (!isRetryableTransportError(error)) {
          throw error;
        }
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Gemini generation failed.');
  }
}
