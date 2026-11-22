import type { ApiErrorCode, ApiErrorDetail } from '@uaqa/contracts';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details: readonly ApiErrorDetail[] | undefined;
  public readonly exposeMessage: boolean;

  public constructor(options: {
    message: string;
    statusCode: number;
    code: ApiErrorCode;
    details?: readonly ApiErrorDetail[];
    exposeMessage?: boolean;
  }) {
    super(options.message);
    this.name = new.target.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.exposeMessage = options.exposeMessage ?? options.statusCode < 500;
  }
}

export class UnauthorizedError extends AppError {
  public constructor(message = 'Authentication is required.') {
    super({ message, statusCode: 401, code: 'UNAUTHORIZED', exposeMessage: true });
  }
}

export class EmailNotVerifiedError extends AppError {
  public constructor(
    message = 'Email verification is required before accessing this application.',
  ) {
    super({ message, statusCode: 403, code: 'EMAIL_NOT_VERIFIED', exposeMessage: true });
  }
}

export class ForbiddenError extends AppError {
  public constructor(message = 'You do not have permission to perform this action.') {
    super({ message, statusCode: 403, code: 'FORBIDDEN', exposeMessage: true });
  }
}

export class ValidationError extends AppError {
  public constructor(message = 'Request validation failed.', details?: readonly ApiErrorDetail[]) {
    super({
      message,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      ...(details ? { details } : {}),
      exposeMessage: true,
    });
  }
}

export class NotFoundError extends AppError {
  public constructor(message = 'The requested resource was not found.') {
    super({ message, statusCode: 404, code: 'NOT_FOUND', exposeMessage: true });
  }
}

export class RateLimitError extends AppError {
  public constructor(message = 'Too many requests. Please try again later.') {
    super({ message, statusCode: 429, code: 'RATE_LIMITED', exposeMessage: true });
  }
}

export class ServiceUnavailableError extends AppError {
  public constructor(message = 'A required upstream service is currently unavailable.') {
    super({ message, statusCode: 503, code: 'SERVICE_UNAVAILABLE', exposeMessage: true });
  }
}
