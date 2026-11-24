import {
  advisoryBriefingQuerySchema,
  advisoryCompareBodySchema,
  advisoryExplainBodySchema,
  advisoryRefreshBodySchema,
} from '@uaqa/contracts';
import { Router } from 'express';
import type { AppConfig } from '../../config/env.ts';
import { createAuthenticateMiddleware, requireVerifiedEmail } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/authorize.ts';
import { createApiRateLimiter } from '../../middleware/rateLimiter.ts';
import { validateRequest } from '../../middleware/validate.ts';
import type { RoleResolver, TokenVerifier } from '../../services/auth/tokenVerifier.ts';
import { AdvisoryController } from './advisory.controller.ts';
import type { AdvisoryService } from './advisory.service.ts';

export function createAdvisoryRouter(deps: {
  readonly config: AppConfig;
  readonly tokenVerifier: TokenVerifier;
  readonly roleResolver: RoleResolver;
  readonly advisoryService: AdvisoryService;
  readonly rateLimitMaxRequests?: number;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.tokenVerifier, deps.roleResolver);
  const controller = new AdvisoryController(deps.advisoryService);
  const aiRateLimiter = createApiRateLimiter(
    deps.config,
    deps.rateLimitMaxRequests ?? deps.config.rateLimitAuthMaxRequests,
  );

  router.use(authenticate, requireVerifiedEmail, aiRateLimiter);

  router.get(
    '/briefing',
    requirePermission('recommendations:read_own'),
    validateRequest({ query: advisoryBriefingQuerySchema }),
    controller.getBriefing,
  );

  router.post(
    '/explain-recommendation',
    requirePermission('recommendations:generate_own'),
    validateRequest({ body: advisoryExplainBodySchema }),
    controller.explainRecommendation,
  );

  router.post(
    '/compare-choices',
    requirePermission('recommendations:generate_own'),
    validateRequest({ body: advisoryCompareBodySchema }),
    controller.compareChoices,
  );

  router.post(
    '/refresh',
    requirePermission('recommendations:generate_own'),
    validateRequest({ body: advisoryRefreshBodySchema }),
    controller.refreshBriefing,
  );

  router.get('/metrics', requirePermission('recommendations:read_own'), controller.getMetrics);

  return router;
}
