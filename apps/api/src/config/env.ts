import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  CORS_ALLOWED_ORIGINS: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL_PRIMARY: z.string().min(1).default('gemini-4-hydrogen'),
  FIREBASE_PROJECT_ID: z.string().optional().default(''),
  ADMIN_EMAILS: z.string().optional().default(''),
  COORDINATOR_EMAILS: z.string().optional().default(''),
  AIR_QUALITY_API_PROVIDER: z.enum(['open-meteo', 'airnow', 'iqair']).default('open-meteo'),
  AIR_QUALITY_API_KEY: z.string().optional().default(''),
  AIR_QUALITY_API_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(5000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(10000).default(100),
  RATE_LIMIT_AUTH_MAX_REQUESTS: z.coerce.number().int().min(1).max(1000).default(20),
});

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly apiPort: number;
  readonly appUrl: string;
  readonly corsAllowedOrigins: readonly string[];
  readonly geminiApiKey: string;
  readonly geminiModelPrimary: string;
  readonly firebaseProjectId: string;
  readonly adminEmails: readonly string[];
  readonly coordinatorEmails: readonly string[];
  readonly airQualityApiProvider: 'open-meteo' | 'airnow' | 'iqair';
  readonly airQualityApiKey: string;
  readonly airQualityApiTimeoutMs: number;
  readonly rateLimitWindowMs: number;
  readonly rateLimitMaxRequests: number;
  readonly rateLimitAuthMaxRequests: number;
}

function readAppletFirebaseProjectId(): string {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      return '';
    }
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { projectId?: unknown };
    return typeof raw.projectId === 'string' && raw.projectId !== 'remixed-project-id'
      ? raw.projectId.trim()
      : '';
  } catch {
    return '';
  }
}

function parseCsvList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const data = parsed.data;
  const explicitOrigins = data.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const corsAllowedOrigins =
    explicitOrigins.length > 0
      ? explicitOrigins
      : Array.from(
          new Set([
            new URL(data.APP_URL).origin,
            `http://localhost:${data.PORT}`,
            `http://127.0.0.1:${data.PORT}`,
          ]),
        );

  const explicitProjectId = data.FIREBASE_PROJECT_ID.trim();
  const resolvedProjectId =
    explicitProjectId && !explicitProjectId.startsWith('REPLACE_WITH')
      ? explicitProjectId
      : data.NODE_ENV === 'test'
        ? ''
        : readAppletFirebaseProjectId();

  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    apiPort: data.API_PORT,
    appUrl: data.APP_URL,
    corsAllowedOrigins,
    geminiApiKey: data.GEMINI_API_KEY,
    geminiModelPrimary: data.GEMINI_MODEL_PRIMARY,
    firebaseProjectId: resolvedProjectId,
    adminEmails: parseCsvList(data.ADMIN_EMAILS),
    coordinatorEmails: parseCsvList(data.COORDINATOR_EMAILS),
    airQualityApiProvider: data.AIR_QUALITY_API_PROVIDER,
    airQualityApiKey: data.AIR_QUALITY_API_KEY,
    airQualityApiTimeoutMs: data.AIR_QUALITY_API_TIMEOUT_MS,
    rateLimitWindowMs: data.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: data.RATE_LIMIT_MAX_REQUESTS,
    rateLimitAuthMaxRequests: data.RATE_LIMIT_AUTH_MAX_REQUESTS,
  };
}
