import { getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { UserRole } from '@uaqa/contracts';
import { ServiceUnavailableError, UnauthorizedError } from '../../utils/errors.ts';

export interface VerifiedTokenClaims {
  readonly uid: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly authTimeSeconds: number;
}

export interface TokenVerifier {
  verifyIdToken(idToken: string): Promise<VerifiedTokenClaims>;
}

export interface RoleResolver {
  resolveRole(uid: string, claims?: VerifiedTokenClaims): Promise<UserRole>;
}

export class FirebaseAdminTokenVerifier implements TokenVerifier {
  private readonly projectId: string;
  private readonly checkRevoked: boolean;

  public constructor(options: { projectId: string; checkRevoked?: boolean }) {
    this.projectId = options.projectId.trim();
    this.checkRevoked = options.checkRevoked ?? false;
  }

  private getFirebaseApp(): App {
    if (!this.projectId || this.projectId.startsWith('REPLACE_WITH')) {
      throw new ServiceUnavailableError('Authentication service is not configured.');
    }
    if (getApps().length > 0) {
      return getApp();
    }
    return initializeApp({ projectId: this.projectId });
  }

  public async verifyIdToken(idToken: string): Promise<VerifiedTokenClaims> {
    const app = this.getFirebaseApp();
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken, this.checkRevoked);
      if (!decoded.uid || !decoded.email) {
        throw new UnauthorizedError('Token is missing required identity claims.');
      }
      return {
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: decoded.email_verified === true,
        authTimeSeconds: typeof decoded.auth_time === 'number' ? decoded.auth_time : 0,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError || error instanceof ServiceUnavailableError) {
        throw error;
      }
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : 'auth/invalid-token';
      if (code === 'auth/id-token-expired' || code === 'auth/id-token-revoked') {
        throw new UnauthorizedError('Your session has expired. Please sign in again.');
      }
      if (code === 'auth/user-disabled') {
        throw new UnauthorizedError(
          'This account is currently disabled. Contact support for assistance.',
        );
      }
      throw new UnauthorizedError('Invalid or expired authentication token.');
    }
  }
}

/**
 * Server-controlled least-privilege role resolver.
 * Never trusts client-supplied roles or claims; elevated roles require
 * verified email ownership matching trusted server-side configuration.
 */
export class ServerConfiguredRoleResolver implements RoleResolver {
  private readonly adminEmails: ReadonlySet<string>;
  private readonly coordinatorEmails: ReadonlySet<string>;

  public constructor(options?: {
    adminEmails?: readonly string[];
    coordinatorEmails?: readonly string[];
  }) {
    this.adminEmails = new Set(
      (options?.adminEmails ?? []).map((email) => email.trim().toLowerCase()),
    );
    this.coordinatorEmails = new Set(
      (options?.coordinatorEmails ?? []).map((email) => email.trim().toLowerCase()),
    );
  }

  public async resolveRole(_uid: string, claims?: VerifiedTokenClaims): Promise<UserRole> {
    if (!claims?.emailVerified) {
      return 'regular_user';
    }
    const normalizedEmail = claims.email.trim().toLowerCase();
    if (this.adminEmails.has(normalizedEmail)) {
      return 'admin';
    }
    if (this.coordinatorEmails.has(normalizedEmail)) {
      return 'community_coordinator';
    }
    return 'regular_user';
  }
}

export class DefaultLeastPrivilegeRoleResolver extends ServerConfiguredRoleResolver {}
