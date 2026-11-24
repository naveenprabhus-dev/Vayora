import { Router } from 'express';
import { z } from 'zod';
import {
  firestoreIdSchema,
  householdLifestyleInputSchema,
  type AuthenticatedPrincipal,
} from '@uaqa/contracts';
import { createAuthenticateMiddleware, requireVerifiedEmail } from '../../middleware/auth.ts';
import { requireOwnership, requirePermission } from '../../middleware/authorize.ts';
import { validateRequest } from '../../middleware/validate.ts';
import type { HouseholdRepository } from '../../repositories/household.repository.ts';
import type { RoleResolver, TokenVerifier } from '../../services/auth/tokenVerifier.ts';
import { NotFoundError, UnauthorizedError } from '../../utils/errors.ts';
import { sendSuccess } from '../../utils/response.ts';

const ownerParamsSchema = z.object({
  ownerUid: firestoreIdSchema,
});

function getPrincipalOrThrow(
  principal: AuthenticatedPrincipal | undefined,
): AuthenticatedPrincipal {
  if (!principal) {
    throw new UnauthorizedError();
  }
  return principal;
}

export function createHouseholdRouter(deps: {
  tokenVerifier: TokenVerifier;
  roleResolver: RoleResolver;
  householdRepository: HouseholdRepository;
  onHouseholdUpdated?: (ownerUid: string) => void;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.tokenVerifier, deps.roleResolver);

  router.use(authenticate, requireVerifiedEmail);

  router.get('/profile', requirePermission('profile:read_own'), async (req, res, next) => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const profile = await deps.householdRepository.findByOwnerUid(principal.uid);
      if (!profile) {
        next(new NotFoundError('Household profile has not been completed yet.'));
        return;
      }
      sendSuccess(res, { profile }, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  });

  router.get(
    '/profile/:ownerUid',
    requirePermission('profile:read_own'),
    validateRequest({ params: ownerParamsSchema }),
    requireOwnership((req) => req.params.ownerUid),
    async (req, res, next) => {
      try {
        const principal = getPrincipalOrThrow(req.principal);
        const profile = await deps.householdRepository.findByOwnerUid(principal.uid);
        if (!profile) {
          next(new NotFoundError('Household profile has not been completed yet.'));
          return;
        }
        sendSuccess(res, { profile }, 200, req.context?.requestId);
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    '/profile',
    requirePermission('profile:write_own'),
    validateRequest({ body: householdLifestyleInputSchema }),
    async (req, res, next) => {
      try {
        const principal = getPrincipalOrThrow(req.principal);
        const profile = await deps.householdRepository.upsertForOwner(principal.uid, req.body);
        deps.onHouseholdUpdated?.(principal.uid);
        sendSuccess(res, { profile }, 200, req.context?.requestId);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/validate',
    requirePermission('profile:write_own'),
    validateRequest({ body: householdLifestyleInputSchema }),
    (req, res) => {
      const principal = getPrincipalOrThrow(req.principal);
      sendSuccess(
        res,
        {
          valid: true,
          ownerUid: principal.uid,
          profile: req.body,
        },
        200,
        req.context?.requestId,
      );
    },
  );

  return router;
}
