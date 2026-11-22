import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { UserRole } from '@uaqa/contracts';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/env.ts';
import type {
  RoleResolver,
  TokenVerifier,
  VerifiedTokenClaims,
} from '../../src/services/auth/tokenVerifier.ts';
import { UnauthorizedError } from '../../src/utils/errors.ts';

const TOKEN_FIXTURES: Record<string, { claims: VerifiedTokenClaims; role: UserRole }> = {
  'token-unverified': {
    claims: {
      uid: 'user_unverified',
      email: 'unverified@example.org',
      emailVerified: false,
      authTimeSeconds: 1700000000,
    },
    role: 'regular_user',
  },
  'token-user': {
    claims: {
      uid: 'user_regular_1',
      email: 'family@example.org',
      emailVerified: true,
      authTimeSeconds: 1700000000,
    },
    role: 'regular_user',
  },
  'token-coordinator': {
    claims: {
      uid: 'user_coord_1',
      email: 'coord@example.org',
      emailVerified: true,
      authTimeSeconds: 1700000000,
    },
    role: 'community_coordinator',
  },
  'token-admin': {
    claims: {
      uid: 'user_admin_1',
      email: 'admin@example.org',
      emailVerified: true,
      authTimeSeconds: 1700000000,
    },
    role: 'admin',
  },
};

function createFixtureApp() {
  const tokenVerifier: TokenVerifier = {
    async verifyIdToken(idToken: string) {
      const fixture = TOKEN_FIXTURES[idToken];
      if (!fixture) {
        throw new UnauthorizedError('Invalid authentication token.');
      }
      return fixture.claims;
    },
  };
  const roleResolver: RoleResolver = {
    async resolveRole(uid: string) {
      const match = Object.values(TOKEN_FIXTURES).find((entry) => entry.claims.uid === uid);
      return match?.role ?? 'regular_user';
    },
  };
  return createApp({
    config: loadConfig({ NODE_ENV: 'test' }),
    tokenVerifier,
    roleResolver,
  });
}

describe('Authentication, Email Verification, RBAC & IDOR (Integration)', () => {
  const app = createFixtureApp();

  it('blocks unauthenticated guest access to protected endpoints', async () => {
    const res = await request(app).get('/api/v1/system/session');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('fails closed when default Firebase verifier is unconfigured', async () => {
    const unconfiguredApp = createApp({ config: loadConfig({ NODE_ENV: 'test' }) });
    const res = await request(unconfiguredApp)
      .get('/api/v1/system/session')
      .set('Authorization', 'Bearer arbitrary-token');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('rejects authenticated accounts whose email is not verified', async () => {
    const res = await request(app)
      .get('/api/v1/system/session')
      .set('Authorization', 'Bearer token-unverified');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('allows verified regular_user to read session and own resource, but blocks other owners and privileged routes', async () => {
    const sessionRes = await request(app)
      .get('/api/v1/system/session')
      .set('Authorization', 'Bearer token-user');
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.data.principal.role).toBe('regular_user');

    const ownRes = await request(app)
      .get('/api/v1/system/resources/user_regular_1/ownership-check')
      .set('Authorization', 'Bearer token-user');
    expect(ownRes.status).toBe(200);

    const idorRes = await request(app)
      .get('/api/v1/system/resources/user_admin_1/ownership-check')
      .set('Authorization', 'Bearer token-user');
    expect(idorRes.status).toBe(403);
    expect(idorRes.body.error.code).toBe('FORBIDDEN');

    const adminRouteRes = await request(app)
      .get('/api/v1/system/admin/audit-check')
      .set('Authorization', 'Bearer token-user');
    expect(adminRouteRes.status).toBe(403);
  });

  it('enforces community_coordinator vs admin boundaries', async () => {
    const coordAdvisory = await request(app)
      .get('/api/v1/system/coordinator/advisory-check')
      .set('Authorization', 'Bearer token-coordinator');
    expect(coordAdvisory.status).toBe(200);

    const coordAdmin = await request(app)
      .get('/api/v1/system/admin/audit-check')
      .set('Authorization', 'Bearer token-coordinator');
    expect(coordAdmin.status).toBe(403);

    const adminAudit = await request(app)
      .get('/api/v1/system/admin/audit-check')
      .set('Authorization', 'Bearer token-admin');
    expect(adminAudit.status).toBe(200);
  });
});
