import { z } from 'zod';

export const apiErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'EMAIL_NOT_VERIFIED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export const apiMetaSchema = z.object({
  requestId: z.string().min(1).max(128),
  timestamp: z.string().datetime({ offset: true }),
});

export const apiErrorDetailSchema = z.object({
  field: z.string().max(128).optional(),
  message: z.string().min(1).max(500),
  code: z.string().max(64).optional(),
});

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1).max(500),
    details: z.array(apiErrorDetailSchema).max(50).optional(),
  }),
  meta: apiMetaSchema,
});

export function createApiSuccessSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: apiMetaSchema,
  });
}

export const healthStatusPayloadSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.literal('urban-air-quality-api'),
  version: z.string().min(1).max(32),
  environment: z.string().min(1).max(32),
  uptimeSeconds: z.number().nonnegative(),
});
