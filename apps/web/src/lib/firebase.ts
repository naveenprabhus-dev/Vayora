import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from 'firebase/auth';

export const RUNTIME_CONFIG_ELEMENT_ID = 'vayora-runtime-config';

export interface FirebaseAppletConfig {
  readonly projectId?: string | undefined;
  readonly appId?: string | undefined;
  readonly apiKey?: string | undefined;
  readonly authDomain?: string | undefined;
  readonly firestoreDatabaseId?: string | undefined;
  readonly storageBucket?: string | undefined;
  readonly messagingSenderId?: string | undefined;
}

export interface ResolvedFirebaseClientConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly appId: string;
  readonly storageBucket: string;
  readonly messagingSenderId: string;
  readonly databaseId: string;
}

export interface FirebaseConfigResolutionOverrides {
  readonly buildEnv?: Readonly<Record<string, unknown>> | undefined;
  readonly runtimeRawJson?: string | null | undefined;
  readonly appletConfig?: FirebaseAppletConfig | undefined;
}

const RUNTIME_ALLOWED_KEYS = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
  'storageBucket',
  'messagingSenderId',
  'databaseId',
] as const;

const localFirebaseConfigs = import.meta.glob<FirebaseAppletConfig>(
  '../../../../firebase-applet-config.json',
  { eager: true, import: 'default' },
);
const bundledAppletConfig: FirebaseAppletConfig = Object.values(localFirebaseConfigs)[0] ?? {};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

function normalizeConfigValue(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('REPLACE_WITH')) {
    return '';
  }
  return trimmed;
}

function readRuntimeConfigJsonFromDom(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const element = document.getElementById(RUNTIME_CONFIG_ELEMENT_ID);
  return element?.textContent ?? null;
}

/**
 * Parses and validates server-injected JSON config safely.
 * Ignores malformed JSON, arrays/primitives, non-string fields, and any non-allowlisted keys.
 */
export function parseRuntimeFirebaseConfig(
  rawJson: string | null | undefined,
): Partial<ResolvedFirebaseClientConfig> {
  if (typeof rawJson !== 'string' || rawJson.trim().length === 0) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {};
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const record = parsed as Record<string, unknown>;
  const result: Record<string, string> = {};

  for (const key of RUNTIME_ALLOWED_KEYS) {
    if (!Object.hasOwn(record, key)) {
      continue;
    }
    const normalized = normalizeConfigValue(record[key]);
    if (normalized) {
      result[key] = normalized;
    }
  }

  return result as Partial<ResolvedFirebaseClientConfig>;
}

function pickFirstNonEmpty(...candidates: ReadonlyArray<unknown>): string {
  for (const candidate of candidates) {
    const normalized = normalizeConfigValue(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

/**
 * Resolves Firebase Web SDK configuration in strict priority order:
 * 1. Build-time `VITE_FIREBASE_*` variables (when available in Vite bundle).
 * 2. Server-provided runtime config (`<script id="vayora-runtime-config" type="application/json">`).
 * 3. `firebase-applet-config.json` fallback (when present in workspace).
 */
export function resolveFirebaseClientConfig(
  overrides?: FirebaseConfigResolutionOverrides,
): ResolvedFirebaseClientConfig {
  const buildEnv: Readonly<Record<string, unknown>> =
    overrides?.buildEnv ?? (import.meta.env as Readonly<Record<string, unknown>>);
  const runtimeRawJson =
    overrides && 'runtimeRawJson' in overrides
      ? overrides.runtimeRawJson
      : readRuntimeConfigJsonFromDom();
  const runtime = parseRuntimeFirebaseConfig(runtimeRawJson);
  const applet = overrides?.appletConfig ?? bundledAppletConfig;

  return {
    apiKey: pickFirstNonEmpty(buildEnv.VITE_FIREBASE_API_KEY, runtime.apiKey, applet.apiKey),
    authDomain: pickFirstNonEmpty(
      buildEnv.VITE_FIREBASE_AUTH_DOMAIN,
      runtime.authDomain,
      applet.authDomain,
    ),
    projectId: pickFirstNonEmpty(
      buildEnv.VITE_FIREBASE_PROJECT_ID,
      runtime.projectId,
      applet.projectId,
    ),
    appId: pickFirstNonEmpty(buildEnv.VITE_FIREBASE_APP_ID, runtime.appId, applet.appId),
    storageBucket: pickFirstNonEmpty(
      buildEnv.VITE_FIREBASE_STORAGE_BUCKET,
      runtime.storageBucket,
      applet.storageBucket,
    ),
    messagingSenderId: pickFirstNonEmpty(
      buildEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
      runtime.messagingSenderId,
      applet.messagingSenderId,
    ),
    databaseId: pickFirstNonEmpty(
      buildEnv.VITE_FIREBASE_DATABASE_ID,
      runtime.databaseId,
      applet.firestoreDatabaseId,
    ),
  };
}

export function isFirebaseClientConfigured(overrides?: FirebaseConfigResolutionOverrides): boolean {
  const cfg = resolveFirebaseClientConfig(overrides);
  return cfg.apiKey.length > 0 && cfg.projectId.length > 0 && cfg.appId.length > 0;
}

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) {
    return cachedApp;
  }
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    cachedApp = existingApps[0];
    return cachedApp;
  }
  const cfg = resolveFirebaseClientConfig();
  cachedApp = initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
  });
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) {
    return cachedAuth;
  }
  const authInstance = getAuth(getFirebaseApp());
  if (typeof window !== 'undefined') {
    // Session strategy: keep refresh state inside IndexedDB via browserLocalPersistence;
    // never store raw tokens or sensitive secrets in localStorage/sessionStorage.
    void setPersistence(authInstance, browserLocalPersistence).catch(() => undefined);
  }
  cachedAuth = authInstance;
  return cachedAuth;
}

export function resetFirebaseClientAuthCacheForTests(): void {
  cachedApp = null;
  cachedAuth = null;
}
