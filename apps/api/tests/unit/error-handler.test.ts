import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createErrorHandler } from '../../src/middleware/errorHandler.ts';
import { ServiceUnavailableError } from '../../src/utils/errors.ts';

function createMockResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return {
    res: { status } as unknown as Response,
    status,
    json,
  };
}

function createMockRequest(): Request {
  return {
    method: 'GET',
    originalUrl: '/api/v1/household/profile',
    context: {
      requestId: 'req-err-handler-1',
      startedAtMs: Date.now(),
    },
  } as unknown as Request;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('API errorHandler PII and raw exception protection', () => {
  it('suppresses raw Firebase exception details, PII, and stacks in production mode', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = createErrorHandler(true);
    const { res, status, json } = createMockResponse();

    const rawFirebaseError = new Error(
      'FirebaseError: permission-denied for elena@household.org uid=uid_secret_1 token=Bearer secret123',
    );

    handler(rawFirebaseError, createMockRequest(), res, vi.fn() as NextFunction);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while processing the request.',
        }),
      }),
    );

    const payloadJson = JSON.stringify(json.mock.calls[0]?.[0]);
    expect(payloadJson).not.toContain('FirebaseError');
    expect(payloadJson).not.toContain('elena@household.org');
    expect(payloadJson).not.toContain('uid_secret_1');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(logged).not.toContain('elena@household.org');
    expect(logged).not.toContain('FirebaseError');
    expect(logged).not.toContain('uid_secret_1');
    expect(logged).not.toContain('"stack"');
  });

  it('redacts PII from development logs while preserving non-sensitive diagnostics', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = createErrorHandler(false);
    const { res } = createMockResponse();

    const devError = new Error('Firestore request failed for resident@household.org');
    handler(devError, createMockRequest(), res, vi.fn() as NextFunction);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(logged).toContain('"stack"');
    expect(logged).toContain('[REDACTED]');
    expect(logged).not.toContain('resident@household.org');
  });

  it('masks unexposed 5xx AppError messages in both production responses and production logs', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = createErrorHandler(true);
    const { res, status, json } = createMockResponse();

    const hiddenInternal = new (class extends ServiceUnavailableError {
      public override readonly exposeMessage = false;
    })('Sensitive upstream message for admin@example.org');

    handler(hiddenInternal, createMockRequest(), res, vi.fn() as NextFunction);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: 'An internal server error occurred.',
        }),
      }),
    );
    const logged = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(logged).not.toContain('Sensitive upstream message');
    expect(logged).not.toContain('admin@example.org');
  });
});
