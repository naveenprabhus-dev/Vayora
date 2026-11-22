import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { redactSensitiveData } from '../utils/redact.ts';

export interface RequestContext {
  readonly requestId: string;
  readonly startedAtMs: number;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

export function attachRequestContext(req: Request, res: Response, next: NextFunction): void {
  const incomingRequestId = req.header('x-request-id');
  const safeRequestId =
    incomingRequestId && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  req.context = {
    requestId: safeRequestId,
    startedAtMs: Date.now(),
  };
  res.setHeader('X-Request-Id', safeRequestId);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    const durationMs = req.context ? Date.now() - req.context.startedAtMs : 0;
    const logEntry = redactSensitiveData({
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      requestId: req.context?.requestId ?? 'unknown',
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      durationMs,
    });
    if (process.env.NODE_ENV !== 'test') {
      console.info(JSON.stringify(logEntry));
    }
  });
  next();
}
