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
  primaryCommuteMode: 'gas_vehicle',
  outdoorActivityPattern: 'school_run_family',
  ventilationContext: 'natural_windows',
  hasIndoorAirPurifier: true,
  heatingType: 'district',
  lifestylePreferences: {
    preferredGuidanceFocus: 'balanced',
    reminderCadence: 'daily_smog_alerts',
  },
  onboardingCompleted: true,
};

function createUpstreamPayload(usAqiValue = 112): RawOpenMeteoAirQualityResponse {
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
      time: '2026-11-22T08:00',
      pm2_5: usAqiValue > 150 ? 64.0 : 39.8,
      pm10: 54.0,
      nitrogen_dioxide: 48.0,
      sulphur_dioxide: 9.0,
      carbon_monoxide: 490,
      ozone: 36.0,
      us_aqi: usAqiValue,
      european_aqi: usAqiValue > 150 ? 84 : 62,
      us_aqi_pm2_5: usAqiValue,
      us_aqi_pm10: 44,
      us_aqi_nitrogen_dioxide: 24,
      us_aqi_sulphur_dioxide: 6,
      us_aqi_carbon_monoxide: 5,
      us_aqi_ozone: 16,
    },
    hourly: {
      time: Array.from({ length: 24 }, (_, i) => {
        const hour = (8 + i) % 24;
        const day = 8 + i >= 24 ? '23' : '22';
        return `2026-11-${day}T${String(hour).padStart(2, '0')}:00`;
      }),
      us_aqi: Array.from({ length: 24 }, (_, i) => (i >= 4 && i <= 7 ? 72 : usAqiValue)),
      european_aqi: Array.from({ length: 24 }, (_, i) => (i >= 4 && i <= 7 ? 45 : 64)),
      pm2_5: Array.from({ length: 24 }, (_, i) => (i >= 4 && i <= 7 ? 21 : 40)),
      pm10: Array.from({ length: 24 }, () => 44),
      nitrogen_dioxide: Array.from({ length: 24 }, () => 34),
      sulphur_dioxide: Array.from({ length: 24 }, () => 8),
      carbon_monoxide: Array.from({ length: 24 }, () => 440),
      ozone: Array.from({ length: 24 }, () => 38),
    },
  };
}

function createRoutinesTestApp(options?: {
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

  return { app, fetchAirQualityMock, geocodeLocationMock };
}

describe('Phase 3 Daily Routines API Routes (Integration)', () => {
  it('enforces authentication, email verification, household existence, and IDOR query strictness', async () => {
    const { app } = createRoutinesTestApp();

    const unauthDaily = await request(app).get('/api/v1/routines/daily');
    expect(unauthDaily.status).toBe(401);

    const unauthRefresh = await request(app).post('/api/v1/routines/refresh').send({});
    expect(unauthRefresh.status).toBe(401);

    const unverifiedDaily = await request(app)
      .get('/api/v1/routines/daily')
      .set('Authorization', 'Bearer token-unverified');
    expect(unverifiedDaily.status).toBe(403);
    expect(unverifiedDaily.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    // Verified user without saved profile -> 404
    const missingProfile = await request(app)
      .get('/api/v1/routines/daily')
      .set('Authorization', 'Bearer token-alice');
    expect(missingProfile.status).toBe(404);

    // Cross-user IDOR query injection rejected by strict Zod schema
    const idorAttempt = await request(app)
      .get('/api/v1/routines/daily?userId=uid_bob')
      .set('Authorization', 'Bearer token-alice');
    expect(idorAttempt.status).toBe(400);
    expect(idorAttempt.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('generates personalized routines using Phase 2 cache, caches routine computations, and updates when household preferences change', async () => {
    const { app, fetchAirQualityMock } = createRoutinesTestApp();

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE);

    const first = await request(app)
      .get('/api/v1/routines/daily')
      .set('Authorization', 'Bearer token-alice');
    expect(first.status).toBe(200);
    expect(first.body.data.cachedResult).toBe(false);
    expect(first.body.data.periods).toHaveLength(4);
    expect(first.body.data.betterTimeWindows.status).toBe('available');
    expect(first.body.data.commuteSummary.savedMode).toBe('gas_vehicle');

    // Second GET with unchanged inputs hits routine cache without redundant computation or upstream fetch
    const second = await request(app)
      .get('/api/v1/routines/daily')
      .set('Authorization', 'Bearer token-alice');
    expect(second.status).toBe(200);
    expect(second.body.data.cachedResult).toBe(true);
    expect(fetchAirQualityMock).toHaveBeenCalledTimes(1);

    // Bob remains isolated from Alice's household routines
    const bobRes = await request(app)
      .get('/api/v1/routines/daily')
      .set('Authorization', 'Bearer token-bob');
    expect(bobRes.status).toBe(404);

    // Update Alice's commute mode to cycling -> fingerprint changes automatically
    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send({
        ...SAVED_HOUSEHOLD_PROFILE,
        primaryCommuteMode: 'cycling',
        heatingType: 'solid_fuel',
      });

    const updated = await request(app)
      .get('/api/v1/routines/daily')
      .set('Authorization', 'Bearer token-alice');
    expect(updated.status).toBe(200);
    expect(updated.body.data.cachedResult).toBe(false);
    expect(updated.body.data.commuteSummary.savedMode).toBe('cycling');
    expect(updated.body.data.routineId).not.toBe(first.body.data.routineId);

    // Explicit POST /refresh forces fresh routine generation
    const refreshed = await request(app)
      .post('/api/v1/routines/refresh')
      .set('Authorization', 'Bearer token-alice')
      .send({ forceRefresh: true });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.cachedResult).toBe(false);
  });

  it('discloses stale cached telemetry and handles completely unavailable upstream data without fabricating clean-air windows', async () => {
    let nowMs = 1_000_000;
    const cacheRepo = new AirQualityCacheRepository({
      cacheTtlMs: 60_000,
      staleTtlMs: 600_000,
      geocodeTtlMs: 3_600_000,
      nowMs: () => nowMs,
    });

    let shouldFail = false;
    const { app } = createRoutinesTestApp({
      cacheRepository: cacheRepo,
      fetchAirQuality: async () => {
        if (shouldFail) {
          throw new Error('Upstream timeout');
        }
        return createUpstreamPayload(178);
      },
    });

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send({
        ...SAVED_HOUSEHOLD_PROFILE,
        primaryCommuteMode: 'cycling',
      });

    // Prime fresh cache & confirm cycling blocked during high pollution
    const highRes = await request(app)
      .get('/api/v1/routines/daily')
      .set('Authorization', 'Bearer token-alice');
    expect(highRes.status).toBe(200);
    const unavailableCycling = highRes.body.data.commuteSummary.options.find(
      (opt: { id: string }) => opt.id === 'commute-active-travel-unavailable',
    );
    expect(unavailableCycling.status).toBe('unavailable');

    // Expire fresh AQ cache & fail upstream -> triggers stale fallback disclosure
    nowMs += 120_000;
    shouldFail = true;

    const staleRes = await request(app)
      .get('/api/v1/routines/daily')
      .set('Authorization', 'Bearer token-alice');
    expect(staleRes.status).toBe(200);
    expect(staleRes.body.data.airQualityContext.transparency.freshnessStatus).toBe('stale');
    expect(staleRes.body.data.betterTimeWindows.status).toBe('stale');

    // User with no cached AQ at all during upstream outage -> honest unavailable routine
    const { app: offlineApp } = createRoutinesTestApp({
      fetchAirQuality: async () => {
        throw new Error('Provider down');
      },
    });
    await request(offlineApp)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE);

    const unavailableRes = await request(offlineApp)
      .get('/api/v1/routines/daily')
      .set('Authorization', 'Bearer token-alice');
    expect(unavailableRes.status).toBe(200);
    expect(unavailableRes.body.data.airQualityContext.transparency.freshnessStatus).toBe(
      'unavailable',
    );
    expect(unavailableRes.body.data.betterTimeWindows.status).toBe('unavailable');
    expect(unavailableRes.body.data.betterTimeWindows.windows).toEqual([]);
  });
});
