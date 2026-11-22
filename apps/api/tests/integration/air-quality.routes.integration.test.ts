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

function createSampleUpstreamPayload(): RawOpenMeteoAirQualityResponse {
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
      time: '2026-11-22T12:00',
      pm2_5: 28.4,
      pm10: 41.2,
      nitrogen_dioxide: 36.1,
      sulphur_dioxide: 8.4,
      carbon_monoxide: 460,
      ozone: 42.0,
      us_aqi: 85,
      european_aqi: 56,
      us_aqi_pm2_5: 85,
      us_aqi_pm10: 38,
      us_aqi_nitrogen_dioxide: 19,
      us_aqi_sulphur_dioxide: 5,
      us_aqi_carbon_monoxide: 4,
      us_aqi_ozone: 19,
    },
    hourly: {
      time: Array.from({ length: 48 }, (_, i) => {
        const day = i < 12 ? '22' : i < 36 ? '23' : '24';
        const hour = (12 + i) % 24;
        return `2026-11-${day}T${String(hour).padStart(2, '0')}:00`;
      }),
      us_aqi: Array.from({ length: 48 }, (_, i) => (i === 5 ? null : 80 + (i % 15))),
      european_aqi: Array.from({ length: 48 }, (_, i) => 50 + (i % 12)),
      pm2_5: Array.from({ length: 48 }, (_, i) => 25 + (i % 8)),
      pm10: Array.from({ length: 48 }, (_, i) => 38 + (i % 10)),
      nitrogen_dioxide: Array.from({ length: 48 }, () => 34),
      sulphur_dioxide: Array.from({ length: 48 }, () => 8),
      carbon_monoxide: Array.from({ length: 48 }, () => 440),
      ozone: Array.from({ length: 48 }, () => 40),
    },
  };
}

function createAirQualityTestApp(options?: {
  readonly fetchAirQuality?: AirQualityProvider['fetchAirQuality'];
  readonly checkAvailability?: AirQualityProvider['checkAvailability'];
  readonly geocodeLocation?: GeocodingProvider['geocodeLocation'];
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
    options?.fetchAirQuality ?? (async () => createSampleUpstreamPayload()),
  );
  const checkAvailabilityMock = vi.fn(options?.checkAvailability ?? (async () => true));
  const geocodeLocationMock = vi.fn(
    options?.geocodeLocation ??
      (async (input) => {
        if (input.city.toLowerCase() === 'unknowncity') {
          return null;
        }
        return {
          latitude: input.city.toLowerCase() === 'warsaw' ? 52.23 : 50.061,
          longitude: input.city.toLowerCase() === 'warsaw' ? 21.012 : 19.937,
          resolvedLabel: `${input.city}, ${input.country}`,
          country: input.country,
          timezone: 'Europe/Warsaw',
        };
      }),
  );

  const app = createApp({
    config: loadConfig({ NODE_ENV: 'test' }),
    tokenVerifier,
    roleResolver: new ServerConfiguredRoleResolver(),
    airQualityProvider: {
      providerId: 'open-meteo',
      fetchAirQuality: fetchAirQualityMock,
      checkAvailability: checkAvailabilityMock,
    },
    geocodingProvider: {
      geocodeLocation: geocodeLocationMock,
    },
    ...(options?.cacheRepository ? { airQualityCacheRepository: options.cacheRepository } : {}),
    ...(options?.rateLimitMaxRequests !== undefined
      ? { rateLimitMaxRequests: options.rateLimitMaxRequests }
      : {}),
  });

  return { app, fetchAirQualityMock, geocodeLocationMock, checkAvailabilityMock };
}

describe('Air Quality Intelligence API Routes (Integration)', () => {
  it('enforces authentication and verified-email gates on all air quality endpoints', async () => {
    const { app } = createAirQualityTestApp();

    const unauthCurrent = await request(app).get('/api/v1/air-quality/current');
    expect(unauthCurrent.status).toBe(401);

    const unauthLocation = await request(app)
      .put('/api/v1/air-quality/location')
      .send({ country: 'Poland', city: 'Krakow', neighborhood: 'Old Town', postalPrefix: '31-0' });
    expect(unauthLocation.status).toBe(401);

    const unverifiedCurrent = await request(app)
      .get('/api/v1/air-quality/current')
      .set('Authorization', 'Bearer token-unverified');
    expect(unverifiedCurrent.status).toBe(403);
    expect(unverifiedCurrent.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('requires saved household profile before resolving default location and rejects cross-user tampering', async () => {
    const { app } = createAirQualityTestApp();

    const missingProfileRes = await request(app)
      .get('/api/v1/air-quality/current')
      .set('Authorization', 'Bearer token-alice');
    expect(missingProfileRes.status).toBe(404);

    // Malicious query attempting cross-user lookup via userId/ownerUid must fail 400
    const idorAttemptRes = await request(app)
      .get('/api/v1/air-quality/current?userId=uid_bob')
      .set('Authorization', 'Bearer token-alice');
    expect(idorAttemptRes.status).toBe(400);
    expect(idorAttemptRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('serves current, forecast, pollutants, guidance, and health endpoints with geocoding & telemetry caching', async () => {
    const { app, fetchAirQualityMock, geocodeLocationMock } = createAirQualityTestApp();

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE);

    const currentRes = await request(app)
      .get('/api/v1/air-quality/current')
      .set('Authorization', 'Bearer token-alice');
    expect(currentRes.status).toBe(200);
    expect(currentRes.body.data.location.city).toBe('Krakow');
    expect(currentRes.body.data.aqi.usAqi.value).toBe(85);
    expect(currentRes.body.data.aqi.europeanAqi.value).toBe(56);
    expect(currentRes.body.data.aqi.dominantPollutant.abbreviation).toBe('PM2.5');
    expect(currentRes.body.data.pollutants).toHaveLength(6);
    expect(currentRes.body.data.transparency.freshnessStatus).toBe('fresh');
    expect(currentRes.body.data.transparency.dataNature).toBe('model_forecast');

    // Subsequent endpoints reuse both geocode cache and fresh air-quality cache
    const forecastRes = await request(app)
      .get('/api/v1/air-quality/forecast?hours=48')
      .set('Authorization', 'Bearer token-alice');
    expect(forecastRes.status).toBe(200);
    expect(forecastRes.body.data.horizonHours).toBe(48);
    expect(forecastRes.body.data.hourly).toHaveLength(48);

    const pollutantsRes = await request(app)
      .get('/api/v1/air-quality/pollutants')
      .set('Authorization', 'Bearer token-alice');
    expect(pollutantsRes.status).toBe(200);
    expect(pollutantsRes.body.data.pollutants).toHaveLength(6);

    const guidanceRes = await request(app)
      .get('/api/v1/air-quality/guidance')
      .set('Authorization', 'Bearer token-alice');
    expect(guidanceRes.status).toBe(200);
    expect(guidanceRes.body.data.guidance.fogDistinctionNote).toContain('water-vapor fog');

    const healthRes = await request(app)
      .get('/api/v1/air-quality/health')
      .set('Authorization', 'Bearer token-alice');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.data.status).toBe('ok');
    expect(healthRes.body.data.providerReachable).toBe(true);

    expect(geocodeLocationMock).toHaveBeenCalledTimes(1);
    expect(fetchAirQualityMock).toHaveBeenCalledTimes(1);
  });

  it('updates saved household location cleanly and rejects unresolvable locations', async () => {
    const { app } = createAirQualityTestApp();

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE);

    const updateRes = await request(app)
      .put('/api/v1/air-quality/location')
      .set('Authorization', 'Bearer token-alice')
      .send({
        country: 'Poland',
        city: 'Warsaw',
        neighborhood: 'Mokotow',
        postalPrefix: '02-5',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.location.city).toBe('Warsaw');
    expect(updateRes.body.data.location.latitude).toBeCloseTo(52.23, 2);

    // Bob's profile stays untouched (isolated per UID)
    const bobProfileRes = await request(app)
      .get('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-bob');
    expect(bobProfileRes.status).toBe(404);

    // Unknown city returns clean 400 validation error
    const badCityRes = await request(app)
      .put('/api/v1/air-quality/location')
      .set('Authorization', 'Bearer token-alice')
      .send({
        country: 'Poland',
        city: 'UnknownCity',
        neighborhood: 'Center',
        postalPrefix: '00-0',
      });
    expect(badCityRes.status).toBe(400);
    expect(badCityRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('falls back to stale cached readings when upstream fails after fresh TTL and serves honest unavailable state when no cache exists', async () => {
    let nowMs = 1_000_000;
    const cacheRepo = new AirQualityCacheRepository({
      cacheTtlMs: 60_000,
      staleTtlMs: 600_000,
      geocodeTtlMs: 3_600_000,
      nowMs: () => nowMs,
    });

    let shouldFailUpstream = false;
    const { app } = createAirQualityTestApp({
      cacheRepository: cacheRepo,
      fetchAirQuality: async () => {
        if (shouldFailUpstream) {
          throw new Error('Upstream Open-Meteo timeout');
        }
        return createSampleUpstreamPayload();
      },
    });

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE);

    // Prime fresh cache
    const first = await request(app)
      .get('/api/v1/air-quality/current')
      .set('Authorization', 'Bearer token-alice');
    expect(first.status).toBe(200);
    expect(first.body.data.transparency.freshnessStatus).toBe('fresh');

    // Expire fresh cache, enable upstream failure -> must return stale fallback
    nowMs += 120_000;
    shouldFailUpstream = true;

    const staleRes = await request(app)
      .get('/api/v1/air-quality/current')
      .set('Authorization', 'Bearer token-alice');
    expect(staleRes.status).toBe(200);
    expect(staleRes.body.data.transparency.freshnessStatus).toBe('stale');
    expect(staleRes.body.data.transparency.fallbackActive).toBe(true);
    expect(staleRes.body.data.transparency.observationTimestamp).toBe('2026-11-22T12:00');
    expect(staleRes.body.data.aqi.usAqi.value).toBe(85);

    // Query uncached coordinates while upstream is failing -> must return honest unavailable
    const unavailableRes = await request(app)
      .get('/api/v1/air-quality/current?latitude=48.856&longitude=2.352')
      .set('Authorization', 'Bearer token-alice');
    expect(unavailableRes.status).toBe(200);
    expect(unavailableRes.body.data.transparency.freshnessStatus).toBe('unavailable');
    expect(unavailableRes.body.data.aqi.usAqi.value).toBeNull();
    expect(unavailableRes.body.data.aqi.usAqi.status).toBe('unavailable');
    expect(unavailableRes.body.data.guidance.status).toBe('general_precaution');
  });

  it('rejects malformed or out-of-range query parameters and enforces rate limiting without credential leakage', async () => {
    const { app } = createAirQualityTestApp({ rateLimitMaxRequests: 4 });

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE);

    const badLat = await request(app)
      .get('/api/v1/air-quality/current?latitude=95&longitude=19')
      .set('Authorization', 'Bearer token-alice');
    expect(badLat.status).toBe(400);
    expect(badLat.body.error.code).toBe('VALIDATION_ERROR');

    const unpairedLon = await request(app)
      .get('/api/v1/air-quality/forecast?longitude=19.9')
      .set('Authorization', 'Bearer token-alice');
    expect(unpairedLon.status).toBe(400);

    const third = await request(app)
      .get('/api/v1/air-quality/health')
      .set('Authorization', 'Bearer token-alice');
    expect(third.status).toBe(200);

    const rateLimited = await request(app)
      .get('/api/v1/air-quality/health')
      .set('Authorization', 'Bearer token-alice');
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.body.error.code).toBe('RATE_LIMITED');
    expect(JSON.stringify(rateLimited.body)).not.toContain('FIREBASE');
  });
});
