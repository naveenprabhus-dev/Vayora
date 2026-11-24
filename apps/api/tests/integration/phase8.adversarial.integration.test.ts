import type { HouseholdLifestyleInput } from '@uaqa/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/env.ts';
import type { RawOpenMeteoAirQualityResponse } from '../../src/modules/air-quality/air-quality.schemas.ts';
import type {
  AirQualityProvider,
  GeocodingProvider,
} from '../../src/modules/air-quality/providers/air-quality.provider.interface.ts';
import {
  GeminiTimeoutError,
  type GeminiAdvisoryClient,
} from '../../src/services/ai/geminiClient.ts';
import {
  ServerConfiguredRoleResolver,
  type TokenVerifier,
} from '../../src/services/auth/tokenVerifier.ts';
import { UnauthorizedError } from '../../src/utils/errors.ts';

const VALID_PROFILE: HouseholdLifestyleInput = {
  country: 'Poland',
  city: 'Krakow',
  neighborhood: 'Krowodrza',
  postalPrefix: '30-01',
  locationPreferences: {
    primaryZoneType: 'valley_basin',
    alertsEnabled: true,
  },
  householdSize: 3,
  householdComposition: ['adults', 'young_children'],
  primaryCommuteMode: 'gas_vehicle',
  outdoorActivityPattern: 'school_run_family',
  ventilationContext: 'natural_windows',
  hasIndoorAirPurifier: false,
  heatingType: 'solid_fuel',
  lifestylePreferences: {
    preferredGuidanceFocus: 'balanced',
    reminderCadence: 'daily_smog_alerts',
  },
  onboardingCompleted: true,
};

const UPSTREAM_AQI: RawOpenMeteoAirQualityResponse = {
  latitude: 50.061,
  longitude: 19.937,
  timezone: 'Europe/Warsaw',
  current_units: {
    pm2_5: 'µg/m³',
    pm10: 'µg/m³',
    nitrogen_dioxide: 'µg/m³',
    sulphur_dioxide: 'µg/m³',
    carbon_monoxide: 'µg/m³',
    ozone: 'µg/m³',
    us_aqi: 'US AQI',
    european_aqi: 'EAQI',
  },
  current: {
    time: '2026-11-24T09:00',
    pm2_5: 62.0,
    pm10: 78.0,
    nitrogen_dioxide: 35.0,
    sulphur_dioxide: 9.0,
    carbon_monoxide: 410,
    ozone: 28.0,
    us_aqi: 158,
    european_aqi: 82,
    us_aqi_pm2_5: 158,
    us_aqi_pm10: 62,
    us_aqi_nitrogen_dioxide: 22,
    us_aqi_sulphur_dioxide: 6,
    us_aqi_carbon_monoxide: 5,
    us_aqi_ozone: 14,
  },
  hourly: {
    time: ['2026-11-24T09:00', '2026-11-24T10:00'],
    us_aqi: [158, 150],
    european_aqi: [82, 79],
    pm2_5: [62, 58],
    pm10: [78, 74],
    nitrogen_dioxide: [35, 33],
    sulphur_dioxide: [9, 8],
    carbon_monoxide: [410, 400],
    ozone: [28, 30],
  },
};

function createAdversarialTestApp(options?: { readonly geminiClient?: GeminiAdvisoryClient }) {
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
          email: 'pending@example.org',
          emailVerified: false,
          authTimeSeconds: 1700000000,
        };
      }
      throw new UnauthorizedError('Token expired or revoked');
    },
  };

  const airQualityProvider: AirQualityProvider = {
    providerId: 'open-meteo',
    fetchAirQuality: async () => UPSTREAM_AQI,
    checkAvailability: async () => true,
  };

  const geocodingProvider: GeocodingProvider = {
    geocodeLocation: async ({ city, country }) => ({
      resolvedLabel: `${city}, ${country}`,
      country,
      latitude: 50.061,
      longitude: 19.937,
      timezone: 'Europe/Warsaw',
    }),
  };

  const config = loadConfig({
    NODE_ENV: 'test',
    GEMINI_API_KEY: 'super-secret-server-gemini-key-should-never-leak',
  });

  return createApp({
    config,
    tokenVerifier,
    roleResolver: new ServerConfiguredRoleResolver({
      adminEmails: ['admin@example.org'],
      coordinatorEmails: ['coord@example.org'],
    }),
    airQualityProvider,
    geocodingProvider,
    ...(options?.geminiClient ? { geminiClient: options.geminiClient } : {}),
  });
}

describe('Phase 8 Adversarial Security & Resilience Suite (Integration)', () => {
  it('F8-01: returns structured 400/413 client envelopes for malformed JSON and >64kb payloads without stack traces', async () => {
    const app = createAdversarialTestApp();

    const malformed = await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .set('Content-Type', 'application/json')
      .send('{"city": "Krakow", invalid_json');

    expect(malformed.status).toBe(400);
    expect(malformed.body.success).toBe(false);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(malformed.body)).not.toContain('SyntaxError');
    expect(JSON.stringify(malformed.body)).not.toContain('node_modules');

    const oversized = await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ ...VALID_PROFILE, neighborhood: 'A'.repeat(90_000) }));

    expect(oversized.status).toBe(413);
    expect(oversized.body.success).toBe(false);
    expect(oversized.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing/revoked/unverified tokens and IDOR attempts across all module endpoints', async () => {
    const app = createAdversarialTestApp();

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(VALID_PROFILE)
      .expect(200);

    const protectedEndpoints = [
      { method: 'get' as const, path: '/api/v1/air-quality/current' },
      { method: 'get' as const, path: '/api/v1/routines/daily' },
      { method: 'get' as const, path: '/api/v1/indoor-air/guidance' },
      { method: 'get' as const, path: '/api/v1/alternatives/recommendations' },
      { method: 'get' as const, path: '/api/v1/advisory/briefing' },
    ];

    for (const endpoint of protectedEndpoints) {
      const api = request(app);
      const noAuth = await api[endpoint.method](endpoint.path);
      expect(noAuth.status).toBe(401);

      const revokedReq = api[endpoint.method](endpoint.path);
      const revoked = await revokedReq.set('Authorization', 'Bearer expired-revoked-token');
      expect(revoked.status).toBe(401);

      const unverifiedReq = api[endpoint.method](endpoint.path);
      const unverified = await unverifiedReq.set('Authorization', 'Bearer token-unverified');
      expect(unverified.status).toBe(403);
      expect(unverified.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    }

    // Bob cannot read Alice's profile directly or pivot via IDOR query params
    const idorProfile = await request(app)
      .get('/api/v1/household/profile/uid_alice')
      .set('Authorization', 'Bearer token-bob');
    expect(idorProfile.status).toBe(403);

    for (const idorPath of [
      '/api/v1/air-quality/current?userId=uid_alice',
      '/api/v1/routines/daily?userId=uid_alice',
      '/api/v1/indoor-air/guidance?userId=uid_alice',
      '/api/v1/alternatives/recommendations?userId=uid_alice',
      '/api/v1/advisory/briefing?userId=uid_alice',
    ]) {
      const res = await request(app).get(idorPath).set('Authorization', 'Bearer token-bob');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('F8-02: blocks operator injection objects, Unicode Bidi/null bytes, extra auth keys, and malformed compare parameters', async () => {
    const app = createAdversarialTestApp();

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(VALID_PROFILE)
      .expect(200);

    // Operator injection in string fields
    const nosqlInjection = await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send({ ...VALID_PROFILE, city: { $gt: '' } });
    expect(nosqlInjection.status).toBe(400);

    // Unicode null/bidi override injection in household city
    const controlCharRes = await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send({ ...VALID_PROFILE, neighborhood: 'Center\u202e\u0000' });
    expect(controlCharRes.status).toBe(400);

    // Extra unexpected key on password reset request
    const strictAuthRes = await request(app)
      .post('/api/v1/auth/password-reset-request')
      .send({ email: 'alice@example.org', role: 'admin' });
    expect(strictAuthRes.status).toBe(400);

    // Malformed currentOption on alternatives compare endpoint
    const badCompare = await request(app)
      .get(
        '/api/v1/alternatives/compare?alternativeId=transport-trip-chaining-no-idling&currentOption=javascript:alert(1)',
      )
      .set('Authorization', 'Bearer token-alice');
    expect(badCompare.status).toBe(400);
  });

  it('F8-03: falls back cleanly without leaking secrets when Gemini outputs adversarial hallucinations or times out', async () => {
    const adversarialApp = createAdversarialTestApp({
      geminiClient: {
        model: 'gemini-4-hydrogen',
        isConfigured: () => true,
        generateStructuredJson: async () => ({
          rawText: JSON.stringify({
            headline: 'Guaranteed clean air',
            summary: 'Pollution dropped by 45 percent to 12 µg/m³.',
            outdoorInfluenceSummary: 'US AQI 158.',
            indoorContextSummary: 'No indoor sensors.',
            priorityActions: [
              {
                recommendationId: 'transport-trip-chaining-no-idling',
                sourceModule: 'alternatives',
                title: 'Bundle errands',
                rationale: 'Saves PLN 95 per month.',
                impactCategory: 'local_emissions',
              },
            ],
            cautionsAndLimitations: 'Educational only.',
            evidenceRefIds: ['EV-OPEN-METEO'],
          }),
          model: 'gemini-4-hydrogen',
          totalTokens: 90,
          attempts: 1,
        }),
      },
    });

    await request(adversarialApp)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(VALID_PROFILE)
      .expect(200);

    const briefingRes = await request(adversarialApp)
      .get('/api/v1/advisory/briefing')
      .set('Authorization', 'Bearer token-alice')
      .expect(200);

    expect(briefingRes.body.data.generationMeta.generationMode).toBe('deterministic_fallback');
    expect(JSON.stringify(briefingRes.body)).not.toContain(
      'super-secret-server-gemini-key-should-never-leak',
    );

    const timeoutApp = createAdversarialTestApp({
      geminiClient: {
        model: 'gemini-4-hydrogen',
        isConfigured: () => true,
        generateStructuredJson: async () => {
          throw new GeminiTimeoutError(4500);
        },
      },
    });

    await request(timeoutApp)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(VALID_PROFILE)
      .expect(200);

    const timeoutRes = await request(timeoutApp)
      .get('/api/v1/advisory/briefing')
      .set('Authorization', 'Bearer token-alice')
      .expect(200);

    expect(timeoutRes.body.data.generationMeta.generationMode).toBe('deterministic_fallback');
    expect(JSON.stringify(timeoutRes.body)).not.toContain(
      'super-secret-server-gemini-key-should-never-leak',
    );
  });

  it('maintains strict cross-user cache and state isolation across all 5 modules', async () => {
    const app = createAdversarialTestApp();

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(VALID_PROFILE)
      .expect(200);

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-bob')
      .send({
        ...VALID_PROFILE,
        city: 'Gdansk',
        neighborhood: 'Wrzeszcz',
        postalPrefix: '80-2',
        primaryCommuteMode: 'public_transit',
        heatingType: 'heat_pump',
      })
      .expect(200);

    const [aliceAq, aliceRoutines, aliceIndoor, aliceAlts, aliceBriefing] = await Promise.all([
      request(app).get('/api/v1/air-quality/current').set('Authorization', 'Bearer token-alice'),
      request(app).get('/api/v1/routines/daily').set('Authorization', 'Bearer token-alice'),
      request(app).get('/api/v1/indoor-air/guidance').set('Authorization', 'Bearer token-alice'),
      request(app)
        .get('/api/v1/alternatives/recommendations')
        .set('Authorization', 'Bearer token-alice'),
      request(app).get('/api/v1/advisory/briefing').set('Authorization', 'Bearer token-alice'),
    ]);

    const [bobAq, bobRoutines, bobIndoor, bobAlts, bobBriefing] = await Promise.all([
      request(app).get('/api/v1/air-quality/current').set('Authorization', 'Bearer token-bob'),
      request(app).get('/api/v1/routines/daily').set('Authorization', 'Bearer token-bob'),
      request(app).get('/api/v1/indoor-air/guidance').set('Authorization', 'Bearer token-bob'),
      request(app)
        .get('/api/v1/alternatives/recommendations')
        .set('Authorization', 'Bearer token-bob'),
      request(app).get('/api/v1/advisory/briefing').set('Authorization', 'Bearer token-bob'),
    ]);

    expect(aliceAq.body.data.location.city).toBe('Krakow');
    expect(aliceRoutines.body.data.location.city).toBe('Krakow');
    expect(aliceIndoor.body.data.location.city).toBe('Krakow');
    expect(aliceAlts.body.data.location.city).toBe('Krakow');
    expect(aliceBriefing.body.data.location.city).toBe('Krakow');

    expect(bobAq.body.data.location.city).toBe('Gdansk');
    expect(bobRoutines.body.data.location.city).toBe('Gdansk');
    expect(bobIndoor.body.data.location.city).toBe('Gdansk');
    expect(bobAlts.body.data.location.city).toBe('Gdansk');
    expect(bobBriefing.body.data.location.city).toBe('Gdansk');
  });
});
