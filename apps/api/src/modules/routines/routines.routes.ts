import { Router } from 'express';
import { routinesQuerySchema, routinesRefreshBodySchema } from '@uaqa/contracts';
import { createAuthenticateMiddleware, requireVerifiedEmail } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/authorize.ts';
import { validateRequest } from '../../middleware/validate.ts';
import type { RoleResolver, TokenVerifier } from '../../services/auth/tokenVerifier.ts';
import { RoutinesController } from './routines.controller.ts';
import type { RoutinesService } from './routines.service.ts';

export function createRoutinesRouter(deps: {
  readonly tokenVerifier: TokenVerifier;
  readonly roleResolver: RoleResolver;
  readonly routinesService: RoutinesService;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.tokenVerifier, deps.roleResolver);
  const controller = new RoutinesController(deps.routinesService);

  router.use(authenticate, requireVerifiedEmail);

  router.get(
    '/daily',
    requirePermission('recommendations:read_own'),
    validateRequest({ query: routinesQuerySchema }),
    controller.getDaily,
  );

  router.post(
    '/refresh',
    requirePermission('recommendations:generate_own'),
    validateRequest({ body: routinesRefreshBodySchema }),
    controller.refreshDaily,
  );

  return router;
}
