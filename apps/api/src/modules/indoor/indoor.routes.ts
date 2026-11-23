import { Router } from 'express';
import { indoorGuidanceQuerySchema, indoorGuidanceRefreshBodySchema } from '@uaqa/contracts';
import { createAuthenticateMiddleware, requireVerifiedEmail } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/authorize.ts';
import { validateRequest } from '../../middleware/validate.ts';
import type { RoleResolver, TokenVerifier } from '../../services/auth/tokenVerifier.ts';
import { IndoorController } from './indoor.controller.ts';
import type { IndoorAirService } from './indoor.service.ts';

export function createIndoorRouter(deps: {
  readonly tokenVerifier: TokenVerifier;
  readonly roleResolver: RoleResolver;
  readonly indoorAirService: IndoorAirService;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.tokenVerifier, deps.roleResolver);
  const controller = new IndoorController(deps.indoorAirService);

  router.use(authenticate, requireVerifiedEmail);

  router.get(
    '/guidance',
    requirePermission('recommendations:read_own'),
    validateRequest({ query: indoorGuidanceQuerySchema }),
    controller.getGuidance,
  );

  router.post(
    '/refresh',
    requirePermission('recommendations:generate_own'),
    validateRequest({ body: indoorGuidanceRefreshBodySchema }),
    controller.refreshGuidance,
  );

  return router;
}
