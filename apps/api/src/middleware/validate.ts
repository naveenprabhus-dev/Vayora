import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import type { ApiErrorDetail } from '@uaqa/contracts';
import { ValidationError } from '../utils/errors.ts';

export interface ValidationSchemas {
  readonly body?: z.ZodType;
  readonly query?: z.ZodType;
  readonly params?: z.ZodType;
}

function mapZodIssues(issues: readonly z.core.$ZodIssue[]): ApiErrorDetail[] {
  return issues.map((issue) => ({
    ...(issue.path.length > 0 ? { field: issue.path.join('.') } : {}),
    message: issue.message,
    code: issue.code,
  }));
}

export function validateRequest(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const details: ApiErrorDetail[] = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        details.push(...mapZodIssues(result.error.issues));
      } else {
        req.params = result.data as Request['params'];
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        details.push(...mapZodIssues(result.error.issues));
      }
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        details.push(...mapZodIssues(result.error.issues));
      } else {
        req.body = result.data;
      }
    }

    if (details.length > 0) {
      next(new ValidationError('Request validation failed.', details));
      return;
    }
    next();
  };
}
