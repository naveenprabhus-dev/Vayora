import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import {
  getFirebaseApp,
  getFirebaseAuth,
  isFirebaseClientConfigured,
  resolveFirebaseClientConfig,
} from './firebase.ts';

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

let cachedDb: Firestore | null = null;
let connectionCheckRan = false;

export function getFirestoreDb(): Firestore {
  if (cachedDb) {
    return cachedDb;
  }
  const { databaseId } = resolveFirebaseClientConfig();
  const app = getFirebaseApp();
  cachedDb = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  return cachedDb;
}

export function resetFirestoreClientCacheForTests(): void {
  cachedDb = null;
  connectionCheckRan = false;
}

export async function testFirestoreConnection(): Promise<void> {
  if (connectionCheckRan || typeof window === 'undefined' || !isFirebaseClientConfigured()) {
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
