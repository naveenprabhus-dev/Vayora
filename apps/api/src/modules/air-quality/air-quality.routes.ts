import { Router } from 'express';
import { createAuthenticateMiddleware, requireVerifiedEmail } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/authorize.ts';
import { validateRequest } from '../../middleware/validate.ts';
import type { RoleResolver, TokenVerifier } from '../../services/auth/tokenVerifier.ts';
import { AirQualityController } from './air-quality.controller.ts';
import { airQualityQuerySchema, locationUpdateSchema } from './air-quality.schemas.ts';
import type { AirQualityService } from './air-quality.service.ts';

export function createAirQualityRouter(deps: {
  readonly tokenVerifier: TokenVerifier;
  readonly roleResolver: RoleResolver;
  readonly airQualityService: AirQualityService;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.tokenVerifier, deps.roleResolver);
  const controller = new AirQualityController(deps.airQualityService);

  router.use(authenticate, requireVerifiedEmail);

  router.get(
    '/current',
    requirePermission('air_quality:read'),
    validateRequest({ query: airQualityQuerySchema }),
    controller.getCurrent,
  );

  router.get(
    '/forecast',
    requirePermission('air_quality:read'),
    validateRequest({ query: airQualityQuerySchema }),
    controller.getForecast,
  );

  router.get(
    '/pollutants',
    requirePermission('air_quality:read'),
    validateRequest({ query: airQualityQuerySchema }),
    controller.getPollutants,
  );

  router.get(
    '/guidance',
    requirePermission('air_quality:read'),
    validateRequest({ query: airQualityQuerySchema }),
    controller.getGuidance,
  );

  router.get('/health', requirePermission('air_quality:read'), controller.getHealth);

  router.put(
    '/location',
    requirePermission('profile:write_own'),
    validateRequest({ body: locationUpdateSchema }),
    controller.updateLocation,
  );

  return router;
}
