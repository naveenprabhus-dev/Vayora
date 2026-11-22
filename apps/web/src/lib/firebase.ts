import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import firebaseConfig from '../../../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  readonly error: string;
  readonly operationType: OperationType;
  readonly path: string | null;
  readonly authInfo: {
    readonly userId: string | undefined;
    readonly email: string | null | undefined;
    readonly emailVerified: boolean | undefined;
    readonly isAnonymous: boolean | undefined;
    readonly tenantId: string | null | undefined;
    readonly providerInfo: ReadonlyArray<{
      readonly providerId: string;
      readonly displayName: string | null;
      readonly email: string | null;
      readonly photoUrl: string | null;
    }>;
  };
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let connectionCheckRan = false;

function resolveFirebaseClientConfig() {
  const env = import.meta.env;
  const apiKey =
    typeof env.VITE_FIREBASE_API_KEY === 'string' && env.VITE_FIREBASE_API_KEY.trim().length > 0
      ? env.VITE_FIREBASE_API_KEY.trim()
      : firebaseConfig.apiKey;
  const authDomain =
    typeof env.VITE_FIREBASE_AUTH_DOMAIN === 'string' &&
    env.VITE_FIREBASE_AUTH_DOMAIN.trim().length > 0
      ? env.VITE_FIREBASE_AUTH_DOMAIN.trim()
      : firebaseConfig.authDomain;
  const projectId =
    typeof env.VITE_FIREBASE_PROJECT_ID === 'string' &&
    env.VITE_FIREBASE_PROJECT_ID.trim().length > 0
      ? env.VITE_FIREBASE_PROJECT_ID.trim()
      : firebaseConfig.projectId;
  const appId =
    typeof env.VITE_FIREBASE_APP_ID === 'string' && env.VITE_FIREBASE_APP_ID.trim().length > 0
      ? env.VITE_FIREBASE_APP_ID.trim()
      : firebaseConfig.appId;

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
  };
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

export function getFirestoreDb(): Firestore {
  if (cachedDb) {
    return cachedDb;
  }
  const databaseId = firebaseConfig.firestoreDatabaseId?.trim();
  cachedDb = databaseId
    ? getFirestore(getFirebaseApp(), databaseId)
    : getFirestore(getFirebaseApp());
  return cachedDb;
}

export async function testFirestoreConnection(): Promise<void> {
  if (connectionCheckRan || typeof window === 'undefined') {
    return;
  }
  connectionCheckRan = true;
  try {
    const db = getFirestoreDb();
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore appears offline or unreachable with the configured project ID.');
    }
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) ?? [],
    },
    operationType,
    path,
  };

  console.error('Firestore Operation Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
