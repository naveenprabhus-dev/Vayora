import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import type { AppConfig } from '../config/env.ts';
import { buildErrorResponse } from '../utils/response.ts';

export function createApiRateLimiter(
  config: AppConfig,
  maxRequests = config.rateLimitMaxRequests,
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: maxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler(req, res) {
      const requestId = req.context?.requestId ?? 'unknown';
      res.status(429).json(
        buildErrorResponse({
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait before trying again.',
          requestId,
        }),
      );
    },
  });
}

export function createSensitiveRouteRateLimiter(config: AppConfig): RateLimitRequestHandler {
  return createApiRateLimiter(config, config.rateLimitAuthMaxRequests);
}
