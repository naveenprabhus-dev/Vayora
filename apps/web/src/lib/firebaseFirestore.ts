import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFirebaseApp, resolveFirebaseClientConfig } from './firebase.ts';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  readonly code: string;
  readonly operationType: OperationType;
  readonly resourceScope: string | null;
  readonly detail?: string | undefined;
}

export class FirestoreOperationError extends Error {
  public readonly code: string;
  public readonly operationType: OperationType;
  public readonly resourceScope: string | null;

  public constructor(options: {
    code: string;
    operationType: OperationType;
    resourceScope: string | null;
    message: string;
  }) {
    super(options.message);
    this.name = 'FirestoreOperationError';
    this.code = options.code;
    this.operationType = options.operationType;
    this.resourceScope = options.resourceScope;
  }
}

const LOG_SECRET_PATTERNS: readonly RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /AIza[0-9A-Za-z\-_]{20,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
];

let cachedDb: Firestore | null = null;

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
}

export function sanitizeFirestorePath(path: string | null): string | null {
  if (!path) {
    return null;
  }
  const segments = path
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return null;
  }
  return segments
    .map((segment, index) => (index % 2 === 1 && segment !== 'info' ? '[id]' : segment))
    .join('/');
}

function sanitizeDiagnosticText(raw: string): string {
  let sanitized = raw;
  for (const pattern of LOG_SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized.slice(0, 300);
}

function extractFirestoreErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const rawCode = (error as { code: unknown }).code;
    if (typeof rawCode === 'string' && rawCode.trim().length > 0) {
      return rawCode.trim();
    }
  }
  return 'firestore/unknown';
}

function mapFirestoreErrorToUserMessage(code: string, operationType: OperationType): string {
  switch (code) {
    case 'permission-denied':
    case 'firestore/permission-denied':
    case 'unauthenticated':
    case 'firestore/unauthenticated':
      return 'You do not have permission to access or update this household record. Please verify your session and try again.';
    case 'unavailable':
    case 'firestore/unavailable':
    case 'deadline-exceeded':
    case 'firestore/deadline-exceeded':
      return 'Cloud data storage is temporarily unreachable. Please check your connection and try again.';
    case 'not-found':
    case 'firestore/not-found':
      return 'The requested household record could not be found.';
    default:
      return operationType === OperationType.GET || operationType === OperationType.LIST
        ? 'Unable to load your household data right now. Please try again.'
        : 'Unable to save your household data right now. Please try again.';
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const code = extractFirestoreErrorCode(error);
  const resourceScope = sanitizeFirestorePath(path);
  const userMessage = mapFirestoreErrorToUserMessage(code, operationType);

  const isDev = import.meta.env.DEV && import.meta.env.MODE !== 'production';
  const rawMessage = error instanceof Error ? error.message : String(error);
  const logPayload: FirestoreErrorInfo = {
    code,
    operationType,
    resourceScope,
    ...(isDev ? { detail: sanitizeDiagnosticText(rawMessage) } : {}),
  };

  console.error('Firestore Operation Error:', JSON.stringify(logPayload));
  throw new FirestoreOperationError({
    code,
    operationType,
    resourceScope,
    message: userMessage,
  });
}
