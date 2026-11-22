import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/env.ts';
import type { RoleResolver, TokenVerifier } from '../../src/services/auth/tokenVerifier.ts';

describe('Validation & Rate Limiting (Integration)', () => {
  const tokenVerifier: TokenVerifier = {
    async verifyIdToken() {
      return {
        uid: 'user_val_1',
        email: 'val@example.org',
        emailVerified: true,
        authTimeSeconds: 1700000000,
      };
    },
  };
  const roleResolver: RoleResolver = {
    async resolveRole() {
      return 'regular_user';
    },
  };

  it('rejects malformed payloads with structured VALIDATION_ERROR details', async () => {
    const app = createApp({
      config: loadConfig({ NODE_ENV: 'test' }),
      tokenVerifier,
      roleResolver,
    });

    const res = await request(app)
      .post('/api/v1/system/validate-profile-contract')
      .set('Authorization', 'Bearer valid-token')
      .send({
        city: 'A',
        neighborhood: '',
        postalPrefix: '!!',
        householdSize: -2,
        heatingType: 'coal_burner',
        primaryCommuteMode: 'jetpack',
        hasIndoorAirPurifier: 'yes',
        sensitivityGroups: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('enforces rate limiting with 429 RATE_LIMITED response', async () => {
    const app = createApp({
      config: loadConfig({ NODE_ENV: 'test' }),
      tokenVerifier,
      roleResolver,
      rateLimitMaxRequests: 2,
    });

    const first = await request(app).get('/api/v1/health');
    const second = await request(app).get('/api/v1/health');
    const third = await request(app).get('/api/v1/health');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body.success).toBe(false);
    expect(third.body.error.code).toBe('RATE_LIMITED');
  });
});
