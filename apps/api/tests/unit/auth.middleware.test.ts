import type { UserRole } from '@uaqa/contracts';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createAuthenticateMiddleware, requireVerifiedEmail } from '../../src/middleware/auth.ts';
import {
  ServerConfiguredRoleResolver,
  type RoleResolver,
  type TokenVerifier,
} from '../../src/services/auth/tokenVerifier.ts';
import { EmailNotVerifiedError, UnauthorizedError } from '../../src/utils/errors.ts';

function createMockRequest(authHeader?: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader : undefined),
  } as unknown as Request;
}

describe('authentication middleware & role resolution', () => {
  const roleResolver: RoleResolver = {
    resolveRole: vi.fn(async (): Promise<UserRole> => 'regular_user'),
  };

  it('rejects requests without an Authorization header', async () => {
    const verifier: TokenVerifier = { verifyIdToken: vi.fn() };
    const middleware = createAuthenticateMiddleware(verifier, roleResolver);
    const next = vi.fn();

    await middleware(createMockRequest(), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rejects malformed non-Bearer headers', async () => {
    const verifier: TokenVerifier = { verifyIdToken: vi.fn() };
    const middleware = createAuthenticateMiddleware(verifier, roleResolver);
    const next = vi.fn();

    await middleware(createMockRequest('Basic dXNlcjpwYXNz'), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('attaches verified principal resolved from server-side role resolver with claims', async () => {
    const claims = {
      uid: 'uid_verified_1',
      email: 'parent@example.org',
      emailVerified: true,
      authTimeSeconds: 1700000100,
    };
    const verifier: TokenVerifier = {
      verifyIdToken: vi.fn(async () => claims),
    };
    const middleware = createAuthenticateMiddleware(verifier, roleResolver);
    const req = createMockRequest('Bearer valid-token-123');
    const next = vi.fn();

    await middleware(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(roleResolver.resolveRole).toHaveBeenCalledWith('uid_verified_1', claims);
    expect(req.principal).toEqual({
      uid: 'uid_verified_1',
      email: 'parent@example.org',
      emailVerified: true,
      role: 'regular_user',
      authTimeSeconds: 1700000100,
    });
  });

  it('blocks unverified email principals in requireVerifiedEmail', () => {
    const req = {
      principal: {
        uid: 'uid_unverified',
        email: 'pending@example.org',
        emailVerified: false,
        role: 'regular_user',
        authTimeSeconds: 1700000100,
      },
    } as unknown as Request;
    const next = vi.fn();

    requireVerifiedEmail(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(EmailNotVerifiedError));
  });

  it('grants elevated roles in ServerConfiguredRoleResolver only when email is verified and configured', async () => {
    const resolver = new ServerConfiguredRoleResolver({
      adminEmails: ['admin@uaqa.example'],
      coordinatorEmails: ['coord@uaqa.example'],
    });

    expect(
      await resolver.resolveRole('u1', {
        uid: 'u1',
        email: 'admin@uaqa.example',
        emailVerified: false,
        authTimeSeconds: 1700000100,
      }),
    ).toBe('regular_user');

    expect(
      await resolver.resolveRole('u1', {
        uid: 'u1',
        email: 'ADMIN@UAQA.EXAMPLE',
        emailVerified: true,
        authTimeSeconds: 1700000100,
      }),
    ).toBe('admin');

    expect(
      await resolver.resolveRole('u2', {
        uid: 'u2',
        email: 'coord@uaqa.example',
        emailVerified: true,
        authTimeSeconds: 1700000100,
      }),
    ).toBe('community_coordinator');

    expect(
      await resolver.resolveRole('u3', {
        uid: 'u3',
        email: 'family@uaqa.example',
        emailVerified: true,
        authTimeSeconds: 1700000100,
      }),
    ).toBe('regular_user');
  });
});
