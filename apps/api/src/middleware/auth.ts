import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedPrincipal } from '@uaqa/contracts';
import type { RoleResolver, TokenVerifier } from '../services/auth/tokenVerifier.ts';
import { EmailNotVerifiedError, UnauthorizedError } from '../utils/errors.ts';

declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
    }
  }
}

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) {
    throw new UnauthorizedError('Missing Authorization header.');
  }
  const parts = authorizationHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer' || !parts[1]) {
    throw new UnauthorizedError('Authorization header must use Bearer token scheme.');
  }
  return parts[1];
}

export function createAuthenticateMiddleware(
  tokenVerifier: TokenVerifier,
  roleResolver: RoleResolver,
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractBearerToken(req.header('authorization'));
      const claims = await tokenVerifier.verifyIdToken(token);
      const role = await roleResolver.resolveRole(claims.uid, claims);

      req.principal = {
        uid: claims.uid,
        email: claims.email,
        emailVerified: claims.emailVerified,
        role,
        authTimeSeconds: claims.authTimeSeconds,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction): void {
  if (!req.principal) {
    next(new UnauthorizedError());
    return;
  }
  if (!req.principal.emailVerified) {
    next(new EmailNotVerifiedError());
    return;
  }
  next();
}
