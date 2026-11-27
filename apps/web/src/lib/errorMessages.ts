import { z } from 'zod';
import { ApiClientError } from './apiClient.ts';
import { AuthServiceError } from './authService.ts';
import { FirestoreOperationError } from './firebaseFirestore.ts';

const UNSAFE_RAW_ERROR_PATTERNS: readonly RegExp[] = [
  /\bFirebaseError\b/i,
  /\bFirebase:\s*Error\b/i,
  /\bMissing or insufficient permissions\b/i,
  /\bPERMISSION_DENIED\b/i,
  /\bauthInfo\b/i,
  /\bproviderInfo\b/i,
  /\bphotoUrl\b/i,
  /\btenantId\b/i,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i,
  /AIza[0-9A-Za-z\-_]{20,}/,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\n\s+at\s+/,
];

function hasRawFirebaseErrorCode(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const rawCode = (error as { code: unknown }).code;
  if (typeof rawCode !== 'string') {
    return false;
  }
  return (
    rawCode.startsWith('auth/') ||
    rawCode.startsWith('firestore/') ||
    rawCode === 'permission-denied' ||
    rawCode === 'unauthenticated' ||
    rawCode === 'unavailable'
  );
}

export function isUnsafeRawErrorMessage(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return true;
  }
  return UNSAFE_RAW_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function formatSafeUserError(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiClientError) {
    if (error.statusCode >= 500) {
      return fallbackMessage;
    }
    return isUnsafeRawErrorMessage(error.message) ? fallbackMessage : error.message;
  }

  if (error instanceof AuthServiceError || error instanceof FirestoreOperationError) {
    return isUnsafeRawErrorMessage(error.message) ? fallbackMessage : error.message;
  }

  if (error instanceof z.ZodError) {
    return 'Please review the highlighted fields and try again.';
  }

  if (error instanceof TypeError) {
    return fallbackMessage;
  }

  if (error instanceof Error) {
    if (hasRawFirebaseErrorCode(error) || isUnsafeRawErrorMessage(error.message)) {
      return fallbackMessage;
    }
    return error.message.trim();
  }

  return fallbackMessage;
}

export function isSessionAuthError(error: unknown): boolean {
  if (!(error instanceof ApiClientError)) {
    return false;
  }
  return (
    error.statusCode === 401 || (error.statusCode === 403 && error.code === 'EMAIL_NOT_VERIFIED')
  );
}

export function formatWorkspaceError(error: unknown, moduleLabel: string): string {
  if (error instanceof ApiClientError) {
    if (error.statusCode === 401) {
      return `Your session expired or was revoked. Sign in again to reload ${moduleLabel}.`;
    }
    if (error.statusCode === 403 && error.code === 'EMAIL_NOT_VERIFIED') {
      return `Email verification is required before loading ${moduleLabel}.`;
    }
    if (error.statusCode === 403) {
      return `Access to ${moduleLabel} is restricted for this household account.`;
    }
    if (error.statusCode === 404) {
      return `Save your household location and preferences first to unlock ${moduleLabel}.`;
    }
    if (error.statusCode === 429) {
      return `Too many requests while updating ${moduleLabel}. Wait a moment before retrying.`;
    }
    if (error.statusCode >= 500) {
      return `${moduleLabel} encountered a temporary server issue. Your saved profile remains intact—please retry shortly.`;
    }
    return isUnsafeRawErrorMessage(error.message)
      ? `Unable to load ${moduleLabel} right now. Please try again.`
      : error.message;
  }

  if (error instanceof TypeError) {
    return `Unable to reach VAYORA servers while loading ${moduleLabel}. Check your connection and retry.`;
  }

  return formatSafeUserError(error, `Unable to load ${moduleLabel} right now. Please try again.`);
}
