import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from 'firebase/auth';

interface FirebaseAppletConfig {
  readonly projectId?: string;
  readonly appId?: string;
  readonly apiKey?: string;
  readonly authDomain?: string;
  readonly storageBucket?: string;
  readonly messagingSenderId?: string;
}

const localFirebaseConfigs = import.meta.glob<FirebaseAppletConfig>(
  '../../../../firebase-applet-config.json',
  { eager: true, import: 'default' },
);
const firebaseConfig: FirebaseAppletConfig = Object.values(localFirebaseConfigs)[0] ?? {};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

function resolveSetting(envValue: unknown, fileValue: string | undefined): string {
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue.trim();
  }
  return typeof fileValue === 'string' ? fileValue.trim() : '';
}

function resolveFirebaseClientConfig() {
  const env = import.meta.env;
  return {
    apiKey: resolveSetting(env.VITE_FIREBASE_API_KEY, firebaseConfig.apiKey),
    authDomain: resolveSetting(env.VITE_FIREBASE_AUTH_DOMAIN, firebaseConfig.authDomain),
    projectId: resolveSetting(env.VITE_FIREBASE_PROJECT_ID, firebaseConfig.projectId),
    appId: resolveSetting(env.VITE_FIREBASE_APP_ID, firebaseConfig.appId),
    storageBucket: resolveSetting(env.VITE_FIREBASE_STORAGE_BUCKET, firebaseConfig.storageBucket),
    messagingSenderId: resolveSetting(
      env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      firebaseConfig.messagingSenderId,
    ),
  };
}

export function isFirebaseClientConfigured(): boolean {
  const cfg = resolveFirebaseClientConfig();
  return cfg.apiKey.length > 0 && cfg.projectId.length > 0 && cfg.appId.length > 0;
}

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) {
    return cachedApp;
  }
  cachedApp = getApps().length > 0 ? getApp() : initializeApp(resolveFirebaseClientConfig());
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
