import type { Request, Response, Router } from 'express';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const RUNTIME_CONFIG_ELEMENT_ID = 'vayora-runtime-config';

export const PUBLIC_FIREBASE_CONFIG_KEYS = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
  'storageBucket',
  'messagingSenderId',
  'databaseId',
] as const;

export type PublicFirebaseConfigKey = (typeof PUBLIC_FIREBASE_CONFIG_KEYS)[number];

export interface PublicFirebaseClientConfig {
  readonly apiKey?: string | undefined;
  readonly authDomain?: string | undefined;
  readonly projectId?: string | undefined;
  readonly appId?: string | undefined;
  readonly storageBucket?: string | undefined;
  readonly messagingSenderId?: string | undefined;
  readonly databaseId?: string | undefined;
}

export const publicFirebaseClientConfigSchema = z
  .object({
    apiKey: z.string().trim().min(1).max(256).optional(),
    authDomain: z.string().trim().min(1).max(256).optional(),
    projectId: z.string().trim().min(1).max(256).optional(),
    appId: z.string().trim().min(1).max(256).optional(),
    storageBucket: z.string().trim().min(1).max(256).optional(),
    messagingSenderId: z.string().trim().min(1).max(256).optional(),
    databaseId: z.string().trim().min(1).max(256).optional(),
  })
  .strict();

function normalizePublicField(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('REPLACE_WITH')) {
    return undefined;
  }
  return trimmed;
}

/**
 * Explicitly allowlists ONLY public Firebase Web SDK fields from VITE_FIREBASE_* env vars.
 * Never iterates or serializes arbitrary keys from `process.env`.
 */
export function buildPublicFirebaseClientConfig(
  source: Readonly<Record<string, string | undefined>>,
): PublicFirebaseClientConfig {
  const candidate: Record<string, string> = {};

  const mappings: ReadonlyArray<readonly [PublicFirebaseConfigKey, string | undefined]> = [
    ['apiKey', source.VITE_FIREBASE_API_KEY],
    ['authDomain', source.VITE_FIREBASE_AUTH_DOMAIN],
    ['projectId', source.VITE_FIREBASE_PROJECT_ID],
    ['appId', source.VITE_FIREBASE_APP_ID],
    ['storageBucket', source.VITE_FIREBASE_STORAGE_BUCKET],
    ['messagingSenderId', source.VITE_FIREBASE_MESSAGING_SENDER_ID],
    ['databaseId', source.VITE_FIREBASE_DATABASE_ID],
  ];

  for (const [key, rawValue] of mappings) {
    const normalized = normalizePublicField(rawValue);
    if (normalized !== undefined) {
      candidate[key] = normalized;
    }
  }

  return publicFirebaseClientConfigSchema.parse(candidate);
}

/**
 * Safely serializes ONLY allowlisted public Firebase fields into JSON suitable
 * for embedding inside a `<script type="application/json">` tag without allowing
 * HTML/script breakout (`<`, `>`, `&`, U+2028, U+2029 escaped).
 */
export function serializePublicFirebaseConfigForHtml(config: PublicFirebaseClientConfig): string {
  const sanitized: Record<string, string> = {};
  for (const key of PUBLIC_FIREBASE_CONFIG_KEYS) {
    const val = normalizePublicField(config[key]);
    if (val !== undefined) {
      sanitized[key] = val;
    }
  }
  const validated = publicFirebaseClientConfigSchema.parse(sanitized);
  return JSON.stringify(validated)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Injects the non-executable `<script id="vayora-runtime-config" type="application/json">`
 * tag into `<head>` before any ES module scripts execute, preserving strict CSP `script-src 'self'`.
 */
export function injectPublicFirebaseConfigIntoHtml(
  html: string,
  config: PublicFirebaseClientConfig,
): string {
  const existingPattern = new RegExp(
    `<script[^>]*id=["']${RUNTIME_CONFIG_ELEMENT_ID}["'][^>]*>[\\s\\S]*?<\\/script>\\s*`,
    'i',
  );
  const cleanedHtml = html.replace(existingPattern, '');
  const serialized = serializePublicFirebaseConfigForHtml(config);
  const tag = `<script id="${RUNTIME_CONFIG_ELEMENT_ID}" type="application/json">${serialized}</script>`;

  if (/<\/head>/i.test(cleanedHtml)) {
    return cleanedHtml.replace(/<\/head>/i, () => `    ${tag}\n  </head>`);
  }
  return `${tag}\n${cleanedHtml}`;
}

export function createProductionSpaRouter(
  distDir: string,
  publicFirebaseConfig: PublicFirebaseClientConfig,
): Router {
  const router = express.Router();
  router.use(express.static(distDir, { index: false }));
  router.get('*', (_req: Request, res: Response) => {
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      res.status(404).send('Production build not found.');
      return;
    }
    const rawHtml = fs.readFileSync(indexPath, 'utf8');
    const htmlWithConfig = injectPublicFirebaseConfigIntoHtml(rawHtml, publicFirebaseConfig);
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(htmlWithConfig);
  });
  return router;
}
