import { Router } from 'express';
import { forgotPasswordInputSchema, type AuthenticatedPrincipal } from '@uaqa/contracts';
import type { AppConfig } from '../../config/env.ts';
import { createAuthenticateMiddleware, requireVerifiedEmail } from '../../middleware/auth.ts';
import { createSensitiveRouteRateLimiter } from '../../middleware/rateLimiter.ts';
import { validateRequest } from '../../middleware/validate.ts';
import type { RoleResolver, TokenVerifier } from '../../services/auth/tokenVerifier.ts';
import { UnauthorizedError } from '../../utils/errors.ts';
import { sendSuccess } from '../../utils/response.ts';

function getPrincipalOrThrow(
  principal: AuthenticatedPrincipal | undefined,
): AuthenticatedPrincipal {
  if (!principal) {
    throw new UnauthorizedError();
  }
  return principal;
}

export function createAuthRouter(deps: {
  config: AppConfig;
  tokenVerifier: TokenVerifier;
  roleResolver: RoleResolver;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.tokenVerifier, deps.roleResolver);
  const sensitiveLimiter = createSensitiveRouteRateLimiter(deps.config);

  router.get('/session', authenticate, requireVerifiedEmail, (req, res) => {
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

  router.post('/verify-token', sensitiveLimiter, authenticate, requireVerifiedEmail, (req, res) => {
    const principal = getPrincipalOrThrow(req.principal);
    sendSuccess(
      res,
      {
        verified: true,
        principal,
      },
      200,
      req.context?.requestId,
    );
  });

  /**
   * Account-enumeration-resistant password reset audit acknowledgement.
   * Always returns a generic 200 acceptance message regardless of whether the email exists.
   */
  router.post(
    '/password-reset-request',
    sensitiveLimiter,
    validateRequest({ body: forgotPasswordInputSchema }),
    (req, res) => {
      sendSuccess(
        res,
        {
          accepted: true,
          message:
            'If an account exists for that email address, password reset instructions have been sent.',
        },
        200,
        req.context?.requestId,
      );
    },
  );

  return router;
}
