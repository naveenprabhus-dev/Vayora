import { ApiClientError } from './apiClient.ts';

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
    return error.message;
  }

  if (error instanceof TypeError) {
    return `Unable to reach VAYORA servers while loading ${moduleLabel}. Check your connection and retry.`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return `Unable to load ${moduleLabel} right now. Please try again.`;
}
