import type { NextFunction, Request, Response } from 'express';
import { AppError, NotFoundError } from '../utils/errors.ts';
import { redactSensitiveData } from '../utils/redact.ts';
import { buildErrorResponse } from '../utils/response.ts';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
}

export function createErrorHandler(isProduction: boolean) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = req.context?.requestId ?? 'unknown';

    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        console.error(
          JSON.stringify(
            redactSensitiveData({
              level: 'error',
              requestId,
              code: err.code,
              message: err.message,
            }),
          ),
        );
      } else if (
        process.env.NODE_ENV !== 'test' &&
        (err.code === 'UNAUTHORIZED' ||
          err.code === 'EMAIL_NOT_VERIFIED' ||
          err.code === 'FORBIDDEN')
      ) {
        console.warn(
          JSON.stringify(
            redactSensitiveData({
              level: 'warn',
              requestId,
              code: err.code,
              statusCode: err.statusCode,
              method: req.method,
              path: req.originalUrl.split('?')[0],
            }),
          ),
        );
      }

      res.status(err.statusCode).json(
        buildErrorResponse({
          code: err.code,
          message:
            isProduction && !err.exposeMessage ? 'An internal server error occurred.' : err.message,
          requestId,
          ...(err.details ? { details: err.details } : {}),
        }),
      );
      return;
    }

    const rawMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(
      JSON.stringify(
        redactSensitiveData({
          level: 'error',
          requestId,
          message: rawMessage,
          ...(isProduction || !(err instanceof Error) ? {} : { stack: err.stack }),
        }),
      ),
    );

    res.status(500).json(
      buildErrorResponse({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while processing the request.',
        requestId,
      }),
    );
  };
}
