import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../src/app/ErrorBoundary.tsx';
import { ApiClientError } from '../../src/lib/apiClient.ts';
import { AuthServiceError } from '../../src/lib/authService.ts';
import {
  formatSafeUserError,
  formatWorkspaceError,
  isUnsafeRawErrorMessage,
} from '../../src/lib/errorMessages.ts';
import {
  FirestoreOperationError,
  OperationType,
  handleFirestoreError,
  sanitizeFirestorePath,
} from '../../src/lib/firebaseFirestore.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('PII protection and safe error handling (Wave 4B Phase 1)', () => {
  it('sanitizes Firestore document paths without leaking user IDs', () => {
    expect(sanitizeFirestorePath('users/uid_sensitive_987')).toBe('users/[id]');
    expect(sanitizeFirestorePath('users/uid_sensitive_987/private/info')).toBe(
      'users/[id]/private/info',
    );
    expect(sanitizeFirestorePath('households/uid_sensitive_987')).toBe('households/[id]');
    expect(sanitizeFirestorePath(null)).toBeNull();
  });

  it('excludes PII and raw Firebase error messages from handleFirestoreError throws and logs', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('MODE', 'production');

    const rawFirebaseErr = Object.assign(
      new Error(
        'FirebaseError: Missing or insufficient permissions for elena@household.org uid=uid_secret_123 Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig',
      ),
      { code: 'permission-denied' },
    );

    let caught: unknown;
    try {
      handleFirestoreError(
        rawFirebaseErr,
        OperationType.WRITE,
        'users/uid_secret_123/private/info',
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(FirestoreOperationError);
    const typedErr = caught as FirestoreOperationError;
    expect(typedErr.code).toBe('permission-denied');
    expect(typedErr.operationType).toBe(OperationType.WRITE);
    expect(typedErr.resourceScope).toBe('users/[id]/private/info');
    expect(typedErr.message).toBe(
      'You do not have permission to access or update this household record. Please verify your session and try again.',
    );
    expect(typedErr.message).not.toContain('uid_secret_123');
    expect(typedErr.message).not.toContain('elena@household.org');
    expect(typedErr.message).not.toContain('FirebaseError');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const loggedJson = String(errorSpy.mock.calls[0]?.[1] ?? '');
    expect(loggedJson).not.toContain('uid_secret_123');
    expect(loggedJson).not.toContain('elena@household.org');
    expect(loggedJson).not.toContain('authInfo');
    expect(loggedJson).not.toContain('providerInfo');
    expect(loggedJson).not.toContain('photoUrl');
    expect(loggedJson).not.toContain('Missing or insufficient permissions');
    expect(loggedJson).toContain('"resourceScope":"users/[id]/private/info"');
  });

  it('preserves redacted non-PII diagnostic details in development logs', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('MODE', 'development');

    const rawFirebaseErr = Object.assign(
      new Error(
        'Transport timeout while writing elena@household.org token=AIzaSyTestKeyValue000123456789',
      ),
      { code: 'unavailable' },
    );

    expect(() =>
      handleFirestoreError(rawFirebaseErr, OperationType.GET, 'households/uid_dev_42'),
    ).toThrow(FirestoreOperationError);

    const loggedJson = String(errorSpy.mock.calls[0]?.[1] ?? '');
    expect(loggedJson).toContain('"code":"unavailable"');
    expect(loggedJson).toContain('"resourceScope":"households/[id]"');
    expect(loggedJson).toContain(
      '"detail":"Transport timeout while writing [REDACTED] token=[REDACTED]"',
    );
    expect(loggedJson).not.toContain('uid_dev_42');
    expect(loggedJson).not.toContain('elena@household.org');
    expect(loggedJson).not.toContain('AIzaSyTestKeyValue000123456789');
  });

  it('masks raw Firebase errors, JSON blobs, stack traces, and PII in UI error formatters', () => {
    const rawJsonErr = new Error(
      JSON.stringify({
        error: 'permission-denied',
        authInfo: { userId: 'u1', email: 'secret@household.org' },
      }),
    );
    const rawFirebaseErr = Object.assign(new Error('Firebase: Error (auth/internal-error).'), {
      code: 'auth/internal-error',
    });
    const rawEmailErr = new Error('Lookup failed for naveen@example.com');
    const stackErr = new Error('Crash\n    at Object.<anonymous> (/app/src/secret.ts:10:5)');

    expect(isUnsafeRawErrorMessage(rawJsonErr.message)).toBe(true);
    expect(formatSafeUserError(rawJsonErr, 'Safe fallback')).toBe('Safe fallback');
    expect(formatSafeUserError(rawFirebaseErr, 'Safe auth fallback')).toBe('Safe auth fallback');
    expect(formatSafeUserError(rawEmailErr, 'Safe email fallback')).toBe('Safe email fallback');
    expect(formatSafeUserError(stackErr, 'Safe stack fallback')).toBe('Safe stack fallback');

    expect(
      formatWorkspaceError(
        new ApiClientError({
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          message: 'FirebaseError raw detail',
          requestId: 'req-1',
        }),
        'Air Quality',
      ),
    ).toContain('Air Quality encountered a temporary server issue');

    expect(
      formatSafeUserError(
        new AuthServiceError('auth/invalid-credential', 'Invalid email address or password.'),
        'Fallback',
      ),
    ).toBe('Invalid email address or password.');
  });

  it('prevents ErrorBoundary from rendering or logging PII in production mode', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('MODE', 'production');

    function LeakyChild(): null {
      throw new Error('FirebaseError: denied for user@household.org with uid_hidden');
    }

    render(
      <ErrorBoundary>
        <LeakyChild />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('An unexpected rendering error occurred.');
    expect(alert).not.toHaveTextContent('FirebaseError');
    expect(alert).not.toHaveTextContent('user@household.org');

    const prodErrorLogs = errorSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(prodErrorLogs).not.toContain('user@household.org');
    expect(prodErrorLogs).not.toContain('uid_hidden');
  });
});
