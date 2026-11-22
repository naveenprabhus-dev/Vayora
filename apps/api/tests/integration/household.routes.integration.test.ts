import type { HouseholdLifestyleInput } from '@uaqa/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/env.ts';
import {
  ServerConfiguredRoleResolver,
  type TokenVerifier,
} from '../../src/services/auth/tokenVerifier.ts';
import { UnauthorizedError } from '../../src/utils/errors.ts';

const VALID_HOUSEHOLD_PROFILE: HouseholdLifestyleInput = {
  country: 'Poland',
  city: 'Krakow',
  neighborhood: 'Krowodrza',
  postalPrefix: '30-01',
  locationPreferences: {
    primaryZoneType: 'valley_basin',
    alertsEnabled: true,
  },
  householdSize: 4,
  householdComposition: ['adults', 'young_children'],
  primaryCommuteMode: 'public_transit',
  outdoorActivityPattern: 'school_run_family',
  ventilationContext: 'filtered_hvac_merv13',
  hasIndoorAirPurifier: true,
  heatingType: 'district',
  lifestylePreferences: {
    preferredGuidanceFocus: 'indoor_air',
    reminderCadence: 'daily_smog_alerts',
  },
  onboardingCompleted: true,
};

function createHouseholdTestApp() {
  const tokenVerifier: TokenVerifier = {
    async verifyIdToken(token: string) {
      if (token === 'token-alice') {
        return {
          uid: 'uid_alice',
          email: 'alice@example.org',
          emailVerified: true,
          authTimeSeconds: 1700000000,
        };
      }
      if (token === 'token-bob') {
        return {
          uid: 'uid_bob',
          email: 'bob@example.org',
          emailVerified: true,
          authTimeSeconds: 1700000000,
        };
      }
      if (token === 'token-unverified') {
        return {
          uid: 'uid_unverified',
          email: 'unverified@example.org',
          emailVerified: false,
          authTimeSeconds: 1700000000,
        };
      }
      throw new UnauthorizedError();
    },
  };

  return createApp({
    config: loadConfig({ NODE_ENV: 'test' }),
    tokenVerifier,
    roleResolver: new ServerConfiguredRoleResolver(),
  });
}

describe('Household Onboarding & Profile Routes (Integration)', () => {
  it('blocks unauthenticated and unverified requests from household profile endpoints', async () => {
    const app = createHouseholdTestApp();

    const guestRes = await request(app).get('/api/v1/household/profile');
    expect(guestRes.status).toBe(401);

    const unverifiedRes = await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-unverified')
      .send(VALID_HOUSEHOLD_PROFILE);
    expect(unverifiedRes.status).toBe(403);
    expect(unverifiedRes.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('creates, updates, and retrieves a household profile bound strictly to authenticated ownerUid', async () => {
    const app = createHouseholdTestApp();

    const notYetCreated = await request(app)
      .get('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice');
    expect(notYetCreated.status).toBe(404);

    // Attempt to tamper with ownerUid and role in request body: server must enforce token UID
    const saveRes = await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send({
        ...VALID_HOUSEHOLD_PROFILE,
        ownerUid: 'uid_bob',
        role: 'admin',
      });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.data.profile.ownerUid).toBe('uid_alice');
    expect(saveRes.body.data.profile.role).toBeUndefined();
    expect(saveRes.body.data.profile.city).toBe('Krakow');

    const getOwnRes = await request(app)
      .get('/api/v1/household/profile/uid_alice')
      .set('Authorization', 'Bearer token-alice');
    expect(getOwnRes.status).toBe(200);
    expect(getOwnRes.body.data.profile.neighborhood).toBe('Krowodrza');
  });

  it('prevents horizontal privilege escalation (IDOR) across households', async () => {
    const app = createHouseholdTestApp();

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(VALID_HOUSEHOLD_PROFILE);

    const bobCrossAccess = await request(app)
      .get('/api/v1/household/profile/uid_alice')
      .set('Authorization', 'Bearer token-bob');

    expect(bobCrossAccess.status).toBe(403);
    expect(bobCrossAccess.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects malformed or script-injected household payloads with structured 400 validation errors', async () => {
    const app = createHouseholdTestApp();

    const invalidRes = await request(app)
      .post('/api/v1/household/validate')
      .set('Authorization', 'Bearer token-alice')
      .send({
        ...VALID_HOUSEHOLD_PROFILE,
        postalPrefix: '<script>alert(1)</script>',
        householdSize: 99,
        householdComposition: [],
      });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalidRes.body.error.details.length).toBeGreaterThanOrEqual(3);
  });
});
