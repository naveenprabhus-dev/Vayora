import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/env.ts';
import {
  ServerConfiguredRoleResolver,
  type TokenVerifier,
} from '../../src/services/auth/tokenVerifier.ts';
import { UnauthorizedError } from '../../src/utils/errors.ts';

function createAuthIntegrationApp(options?: { rateLimitAuthMaxRequests?: number }) {
  const tokenVerifier: TokenVerifier = {
    async verifyIdToken(token: string) {
      if (token === 'expired-token') {
        throw new UnauthorizedError('Your session has expired. Please sign in again.');
      }
      if (token === 'unverified-token') {
        return {
          uid: 'user_unverified_1',
          email: 'pending@example.org',
          emailVerified: false,
          authTimeSeconds: 1700000100,
        };
      }
      if (token === 'verified-user-token') {
        return {
          uid: 'user_verified_1',
          email: 'family@example.org',
          emailVerified: true,
          authTimeSeconds: 1700000200,
        };
      }
      if (token === 'verified-admin-token') {
        return {
          uid: 'user_admin_1',
          email: 'admin@example.org',
          emailVerified: true,
          authTimeSeconds: 1700000300,
        };
      }
      throw new UnauthorizedError('Invalid or expired authentication token.');
    },
  };

  const config = loadConfig({
    NODE_ENV: 'test',
    ADMIN_EMAILS: 'admin@example.org',
    COORDINATOR_EMAILS: 'coordinator@example.org',
    RATE_LIMIT_AUTH_MAX_REQUESTS: String(options?.rateLimitAuthMaxRequests ?? 20),
  });

  return createApp({
    config,
    tokenVerifier,
    roleResolver: new ServerConfiguredRoleResolver({
      adminEmails: config.adminEmails,
      coordinatorEmails: config.coordinatorEmails,
    }),
  });
}

describe('Auth Routes (Integration)', () => {
  it('rejects missing, malformed, and expired tokens on GET /api/v1/auth/session with 401', async () => {
    const app = createAuthIntegrationApp();

    const missing = await request(app).get('/api/v1/auth/session');
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('UNAUTHORIZED');

    const malformed = await request(app)
      .get('/api/v1/auth/session')
      .set('Authorization', 'Token abc');
    expect(malformed.status).toBe(401);
    expect(malformed.body.error.code).toBe('UNAUTHORIZED');

    const expired = await request(app)
      .get('/api/v1/auth/session')
      .set('Authorization', 'Bearer expired-token');
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe('UNAUTHORIZED');
    expect(expired.body.error.message).toContain('expired');
  });

  it('rejects unverified email accounts with 403 EMAIL_NOT_VERIFIED', async () => {
    const app = createAuthIntegrationApp();

    const res = await request(app)
      .get('/api/v1/auth/session')
      .set('Authorization', 'Bearer unverified-token');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('returns verified principal and least-privilege role from GET /api/v1/auth/session and POST /api/v1/auth/verify-token', async () => {
    const app = createAuthIntegrationApp();

    const sessionRes = await request(app)
      .get('/api/v1/auth/session')
      .set('Authorization', 'Bearer verified-user-token');

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.success).toBe(true);
    expect(sessionRes.body.data.authenticated).toBe(true);
    expect(sessionRes.body.data.principal).toEqual({
      uid: 'user_verified_1',
      email: 'family@example.org',
      emailVerified: true,
      role: 'regular_user',
      authTimeSeconds: 1700000200,
    });

    const verifyRes = await request(app)
      .post('/api/v1/auth/verify-token')
      .set('Authorization', 'Bearer verified-admin-token');

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.verified).toBe(true);
    expect(verifyRes.body.data.principal.role).toBe('admin');
  });

  it('returns uniform account-enumeration-resistant 200 responses for password reset requests', async () => {
    const app = createAuthIntegrationApp();

    const existingEmailRes = await request(app)
      .post('/api/v1/auth/password-reset-request')
      .send({ email: 'family@example.org' });

    const unknownEmailRes = await request(app)
      .post('/api/v1/auth/password-reset-request')
      .send({ email: 'nobody-registered@example.org' });

    expect(existingEmailRes.status).toBe(200);
    expect(unknownEmailRes.status).toBe(200);
    expect(existingEmailRes.body.data.message).toBe(unknownEmailRes.body.data.message);
    expect(existingEmailRes.body.data.accepted).toBe(true);
  });

  it('validates email format and enforces sensitive rate limiting on auth routes', async () => {
    const app = createAuthIntegrationApp({ rateLimitAuthMaxRequests: 2 });

    const invalid = await request(app)
      .post('/api/v1/auth/password-reset-request')
      .send({ email: 'not-an-email' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const second = await request(app)
      .post('/api/v1/auth/password-reset-request')
      .send({ email: 'family@example.org' });
    expect(second.status).toBe(200);

    const third = await request(app)
      .post('/api/v1/auth/password-reset-request')
      .send({ email: 'family@example.org' });
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
  });
});
