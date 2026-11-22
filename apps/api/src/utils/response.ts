import type { Response } from 'express';
import type {
  ApiErrorCode,
  ApiErrorDetail,
  ApiErrorResponse,
  ApiSuccessResponse,
} from '@uaqa/contracts';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  requestId = 'unknown',
): void {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
  res.status(statusCode).json(payload);
}

export function buildErrorResponse(options: {
  code: ApiErrorCode;
  message: string;
  requestId: string;
  details?: readonly ApiErrorDetail[];
}): ApiErrorResponse {
  return {
    success: false,
    error: {
      code: options.code,
      message: options.message,
      ...(options.details && options.details.length > 0 ? { details: options.details } : {}),
    },
    meta: {
      requestId: options.requestId,
      timestamp: new Date().toISOString(),
    },
  };
}
