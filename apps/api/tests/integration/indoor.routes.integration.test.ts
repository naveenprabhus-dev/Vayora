import type { HouseholdLifestyleInput } from '@uaqa/contracts';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/env.ts';
import { AirQualityCacheRepository } from '../../src/modules/air-quality/air-quality.repository.ts';
import type { RawOpenMeteoAirQualityResponse } from '../../src/modules/air-quality/air-quality.schemas.ts';
import type {
  AirQualityProvider,
  GeocodingProvider,
} from '../../src/modules/air-quality/providers/air-quality.provider.interface.ts';
import { MANDATORY_NO_SENSOR_DISCLOSURE } from '../../src/modules/indoor/indoor.constants.ts';
import {
  ServerConfiguredRoleResolver,
  type TokenVerifier,
} from '../../src/services/auth/tokenVerifier.ts';
import { UnauthorizedError } from '../../src/utils/errors.ts';

const SAVED_HOUSEHOLD_PROFILE: HouseholdLifestyleInput = {
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
  ventilationContext: 'natural_windows',
  hasIndoorAirPurifier: true,
  heatingType: 'natural_gas',
  lifestylePreferences: {
    preferredGuidanceFocus: 'indoor_air',
    reminderCadence: 'daily_smog_alerts',
  },
  onboardingCompleted: true,
};

function createUpstreamPayload(usAqiValue = 115): RawOpenMeteoAirQualityResponse {
  return {
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
      time: '2026-11-22T09:00',
      pm2_5: usAqiValue > 150 ? 64.0 : 41.2,
      pm10: 56.0,
      nitrogen_dioxide: 45.0,
      sulphur_dioxide: 8.5,
      carbon_monoxide: 470,
      ozone: 35.0,
      us_aqi: usAqiValue,
      european_aqi: usAqiValue > 150 ? 85 : 64,
      us_aqi_pm2_5: usAqiValue,
      us_aqi_pm10: 45,
      us_aqi_nitrogen_dioxide: 24,
      us_aqi_sulphur_dioxide: 5,
      us_aqi_carbon_monoxide: 5,
      us_aqi_ozone: 16,
    },
    hourly: {
      time: Array.from({ length: 24 }, (_, i) => {
        const hour = (9 + i) % 24;
        const day = 9 + i >= 24 ? '23' : '22';
        return `2026-11-${day}T${String(hour).padStart(2, '0')}:00`;
      }),
      us_aqi: Array.from({ length: 24 }, (_, i) => (i >= 3 && i <= 6 ? 68 : usAqiValue)),
      european_aqi: Array.from({ length: 24 }, (_, i) => (i >= 3 && i <= 6 ? 42 : 64)),
      pm2_5: Array.from({ length: 24 }, (_, i) => (i >= 3 && i <= 6 ? 19 : 41)),
      pm10: Array.from({ length: 24 }, () => 45),
      nitrogen_dioxide: Array.from({ length: 24 }, () => 34),
      sulphur_dioxide: Array.from({ length: 24 }, () => 8),
      carbon_monoxide: Array.from({ length: 24 }, () => 440),
      ozone: Array.from({ length: 24 }, () => 38),
    },
  };
}

function createIndoorTestApp(options?: {
  readonly fetchAirQuality?: AirQualityProvider['fetchAirQuality'];
  readonly cacheRepository?: AirQualityCacheRepository;
  readonly rateLimitMaxRequests?: number;
}) {
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

  const fetchAirQualityMock = vi.fn(
    options?.fetchAirQuality ?? (async () => createUpstreamPayload()),
  );
  const geocodeLocationMock: GeocodingProvider['geocodeLocation'] = vi.fn(async (input) => ({
    latitude: 50.061,
    longitude: 19.937,
    resolvedLabel: `${input.city}, ${input.country}`,
    country: input.country,
    timezone: 'Europe/Warsaw',
  }));

  const app = createApp({
    config: loadConfig({ NODE_ENV: 'test' }),
    tokenVerifier,
    roleResolver: new ServerConfiguredRoleResolver(),
    airQualityProvider: {
      providerId: 'open-meteo',
      fetchAirQuality: fetchAirQualityMock,
      checkAvailability: async () => true,
    },
    geocodingProvider: {
      geocodeLocation: geocodeLocationMock,
    },
    ...(options?.cacheRepository ? { airQualityCacheRepository: options.cacheRepository } : {}),
    ...(options?.rateLimitMaxRequests !== undefined
      ? { rateLimitMaxRequests: options.rateLimitMaxRequests }
      : {}),
  });

  return { app, fetchAirQualityMock };
}

describe('Phase 4 Indoor Air Quality API Routes (Integration)', () => {
  it('enforces authentication, email verification, household ownership, and strict validation', async () => {
    const { app } = createIndoorTestApp();

    const unauthGet = await request(app).get('/api/v1/indoor-air/guidance');
    expect(unauthGet.status).toBe(401);

    const unauthRefresh = await request(app).post('/api/v1/indoor-air/refresh').send({});
    expect(unauthRefresh.status).toBe(401);

    const unverifiedGet = await request(app)
      .get('/api/v1/indoor-air/guidance')
      .set('Authorization', 'Bearer token-unverified');
    expect(unverifiedGet.status).toBe(403);
    expect(unverifiedGet.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    // Missing household profile -> 404
    const missingProfile = await request(app)
      .get('/api/v1/indoor-air/guidance')
      .set('Authorization', 'Bearer token-alice');
    expect(missingProfile.status).toBe(404);

    // IDOR / unknown query parameter rejected with 400 VALIDATION_ERROR
    const idorAttempt = await request(app)
      .get('/api/v1/indoor-air/guidance?userId=uid_bob')
      .set('Authorization', 'Bearer token-alice');
    expect(idorAttempt.status).toBe(400);
    expect(idorAttempt.body.error.code).toBe('VALIDATION_ERROR');

    // Invalid scenario rejected
    const badScenario = await request(app)
      .get('/api/v1/indoor-air/guidance?scenario=unknown_scenario')
      .set('Authorization', 'Bearer token-alice');
    expect(badScenario.status).toBe(400);
    expect(badScenario.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('integrates Phase 2 air quality cache, caches indoor calculations, supports scenarios, and updates on household edits', async () => {
    const { app, fetchAirQualityMock } = createIndoorTestApp();

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE);

    const first = await request(app)
      .get('/api/v1/indoor-air/guidance')
      .set('Authorization', 'Bearer token-alice');
    expect(first.status).toBe(200);
    expect(first.body.data.cachedResult).toBe(false);
    expect(first.body.data.overview.sensorStatus.sensorConnected).toBe(false);
    expect(first.body.data.overview.sensorStatus.disclosureStatement).toBe(
      MANDATORY_NO_SENSOR_DISCLOSURE,
    );
    expect(first.body.data.pollutionSources).toHaveLength(7);

    // Second request hits cache without additional upstream AQ call
    const second = await request(app)
      .get('/api/v1/indoor-air/guidance')
      .set('Authorization', 'Bearer token-alice');
    expect(second.status).toBe(200);
    expect(second.body.data.cachedResult).toBe(true);
    expect(fetchAirQualityMock).toHaveBeenCalledTimes(1);

    // Bob remains isolated from Alice
    const bobRes = await request(app)
      .get('/api/v1/indoor-air/guidance')
      .set('Authorization', 'Bearer token-bob');
    expect(bobRes.status).toBe(404);

    // Scenario simulation query
    const cookingSim = await request(app)
      .get('/api/v1/indoor-air/guidance?scenario=cooking')
      .set('Authorization', 'Bearer token-alice');
    expect(cookingSim.status).toBe(200);
    expect(cookingSim.body.data.scenarioContext.isSimulation).toBe(true);
    expect(cookingSim.body.data.scenarioContext.selectedScenario).toBe('cooking');

    // Update household purifier preference -> regenerates fingerprint cleanly
    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send({
        ...SAVED_HOUSEHOLD_PROFILE,
        hasIndoorAirPurifier: false,
      });

    const updated = await request(app)
      .get('/api/v1/indoor-air/guidance')
      .set('Authorization', 'Bearer token-alice');
    expect(updated.status).toBe(200);
    expect(updated.body.data.cachedResult).toBe(false);
    expect(updated.body.data.purifierGuidance.hasPurifier).toBe(false);

    // Explicit POST /refresh forces fresh recomputation
    const refreshed = await request(app)
      .post('/api/v1/indoor-air/refresh')
      .set('Authorization', 'Bearer token-alice')
      .send({ forceRefresh: true, scenario: 'cleaning' });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.cachedResult).toBe(false);
    expect(refreshed.body.data.scenarioContext.selectedScenario).toBe('cleaning');
  });

  it('handles stale cached telemetry, completely unavailable upstream telemetry, and rate limiting safely', async () => {
    let nowMs = 2_000_000;
    const cacheRepo = new AirQualityCacheRepository({
      cacheTtlMs: 60_000,
      staleTtlMs: 600_000,
      geocodeTtlMs: 3_600_000,
      nowMs: () => nowMs,
    });

    let shouldFail = false;
    const { app } = createIndoorTestApp({
      cacheRepository: cacheRepo,
      fetchAirQuality: async () => {
        if (shouldFail) {
          throw new Error('Upstream timeout');
        }
        return createUpstreamPayload(175);
      },
    });

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE);

    const highRes = await request(app)
      .get('/api/v1/indoor-air/guidance')
      .set('Authorization', 'Bearer token-alice');
    expect(highRes.status).toBe(200);
    expect(highRes.body.data.ventilationGuidance.state).toBe('delay_optional_ventilation');

    nowMs += 120_000;
    shouldFail = true;

    const staleRes = await request(app)
      .get('/api/v1/indoor-air/guidance')
      .set('Authorization', 'Bearer token-alice');
    expect(staleRes.status).toBe(200);
    expect(staleRes.body.data.airQualityContext.transparency.freshnessStatus).toBe('stale');

    // Completely offline app -> insufficient_data ventilation state
    const { app: offlineApp } = createIndoorTestApp({
      fetchAirQuality: async () => {
        throw new Error('Provider unreachable');
      },
      rateLimitMaxRequests: 3,
    });

    await request(offlineApp)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE);

    const unavailableRes = await request(offlineApp)
      .get('/api/v1/indoor-air/guidance')
      .set('Authorization', 'Bearer token-alice');
    expect(unavailableRes.status).toBe(200);
    expect(unavailableRes.body.data.airQualityContext.transparency.freshnessStatus).toBe(
      'unavailable',
    );
    expect(unavailableRes.body.data.ventilationGuidance.state).toBe('insufficient_data');

    // Rate limit enforcement verification
    await request(offlineApp)
      .get('/api/v1/indoor-air/guidance')
      .set('Authorization', 'Bearer token-alice');
    const rateLimited = await request(offlineApp)
      .get('/api/v1/indoor-air/guidance')
      .set('Authorization', 'Bearer token-alice');
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.body.error.code).toBe('RATE_LIMITED');
  });
});
