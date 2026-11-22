import { Router } from 'express';
import { z } from 'zod';
import {
  firestoreIdSchema,
  householdLifestyleInputSchema,
  type AuthenticatedPrincipal,
} from '@uaqa/contracts';
import { createAuthenticateMiddleware, requireVerifiedEmail } from '../../middleware/auth.ts';
import { requireOwnership, requirePermission, requireRole } from '../../middleware/authorize.ts';
import { validateRequest } from '../../middleware/validate.ts';
import type { RoleResolver, TokenVerifier } from '../../services/auth/tokenVerifier.ts';
import { UnauthorizedError } from '../../utils/errors.ts';
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

export function createSystemRouter(deps: {
  tokenVerifier: TokenVerifier;
  roleResolver: RoleResolver;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.tokenVerifier, deps.roleResolver);

  router.use(authenticate, requireVerifiedEmail);

  router.get('/session', (req, res) => {
    const principal = getPrincipalOrThrow(req.principal);
    sendSuccess(
      res,
      {
        authenticated: true,
        principal,
      },
      200,
      req.context?.requestId,
    );
  });

  router.post(
    '/validate-profile-contract',
    validateRequest({ body: householdLifestyleInputSchema }),
    (req, res) => {
      const principal = getPrincipalOrThrow(req.principal);
      sendSuccess(
        res,
        {
          validatedForUid: principal.uid,
          profile: req.body,
        },
        200,
        req.context?.requestId,
      );
    },
  );

  router.get(
    '/resources/:ownerUid/ownership-check',
    validateRequest({ params: ownerParamsSchema }),
    requireOwnership((req) => req.params.ownerUid),
    (req, res) => {
      const principal = getPrincipalOrThrow(req.principal);
      sendSuccess(
        res,
        {
          ownerUid: req.params.ownerUid,
          verifiedByUid: principal.uid,
        },
        200,
        req.context?.requestId,
      );
    },
  );

  router.get(
    '/coordinator/advisory-check',
    requirePermission('community_advisory:publish'),
    (req, res) => {
      const principal = getPrincipalOrThrow(req.principal);
      sendSuccess(
        res,
        {
          authorizedRole: principal.role,
          capability: 'community_advisory:publish',
        },
        200,
        req.context?.requestId,
      );
    },
  );

  router.get('/admin/audit-check', requireRole('admin'), (req, res) => {
    const principal = getPrincipalOrThrow(req.principal);
    sendSuccess(
      res,
      {
        authorizedRole: principal.role,
        capability: 'system:audit_read',
      },
      200,
      req.context?.requestId,
    );
  });

  return router;
}
