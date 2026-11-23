import { Router } from 'express';
import {
  alternativesCompareQuerySchema,
  alternativesQuerySchema,
  alternativesRefreshBodySchema,
} from '@uaqa/contracts';
import { createAuthenticateMiddleware, requireVerifiedEmail } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/authorize.ts';
import { validateRequest } from '../../middleware/validate.ts';
import type { RoleResolver, TokenVerifier } from '../../services/auth/tokenVerifier.ts';
import { AlternativesController } from './alternatives.controller.ts';
import type { SustainableAlternativesService } from './alternatives.service.ts';

export function createAlternativesRouter(deps: {
  readonly tokenVerifier: TokenVerifier;
  readonly roleResolver: RoleResolver;
  readonly alternativesService: SustainableAlternativesService;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.tokenVerifier, deps.roleResolver);
  const controller = new AlternativesController(deps.alternativesService);

  router.use(authenticate, requireVerifiedEmail);

  router.get(
    '/recommendations',
    requirePermission('recommendations:read_own'),
    validateRequest({ query: alternativesQuerySchema }),
    controller.getRecommendations,
  );

  router.get(
    '/compare',
    requirePermission('recommendations:read_own'),
    validateRequest({ query: alternativesCompareQuerySchema }),
    controller.compareAlternative,
  );

  router.post(
    '/refresh',
    requirePermission('recommendations:generate_own'),
    validateRequest({ body: alternativesRefreshBodySchema }),
    controller.refreshRecommendations,
  );

  return router;
}
