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
  hasIndoorAirPurifier: false,
  heatingType: 'solid_fuel',
  lifestylePreferences: {
    preferredGuidanceFocus: 'balanced',
    reminderCadence: 'daily_smog_alerts',
  },
  onboardingCompleted: true,
};

function createUpstreamPayload(usAqiValue = 35): RawOpenMeteoAirQualityResponse {
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
      time: '2026-11-23T09:00',
      pm2_5: usAqiValue > 150 ? 68.0 : 8.5,
      pm10: 18.0,
      nitrogen_dioxide: 21.0,
      sulphur_dioxide: 4.5,
      carbon_monoxide: 260,
      ozone: 36.0,
      us_aqi: usAqiValue,
      european_aqi: usAqiValue > 150 ? 86 : 18,
      us_aqi_pm2_5: usAqiValue,
      us_aqi_pm10: 16,
      us_aqi_nitrogen_dioxide: 14,
      us_aqi_sulphur_dioxide: 3,
      us_aqi_carbon_monoxide: 4,
      us_aqi_ozone: 18,
    },
    hourly: {
      time: Array.from({ length: 24 }, (_, i) => {
        const hour = (9 + i) % 24;
        const day = 9 + i >= 24 ? '24' : '23';
        return `2026-11-${day}T${String(hour).padStart(2, '0')}:00`;
      }),
      us_aqi: Array.from({ length: 24 }, () => usAqiValue),
      european_aqi: Array.from({ length: 24 }, () => (usAqiValue > 150 ? 86 : 18)),
      pm2_5: Array.from({ length: 24 }, () => (usAqiValue > 150 ? 68.0 : 8.5)),
      pm10: Array.from({ length: 24 }, () => 18),
      nitrogen_dioxide: Array.from({ length: 24 }, () => 21),
      sulphur_dioxide: Array.from({ length: 24 }, () => 4.5),
      carbon_monoxide: Array.from({ length: 24 }, () => 260),
      ozone: Array.from({ length: 24 }, () => 36),
    },
  };
}

function createAlternativesTestApp(options?: {
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
      if (token === 'token-unverified') {
        return {
          uid: 'uid_unverified',
          email: 'pending@example.org',
          emailVerified: false,
          authTimeSeconds: 1700000000,
        };
      }
      throw new UnauthorizedError('Invalid test token');
    },
  };

  const airQualityProvider: AirQualityProvider = {
    providerId: 'open-meteo',
    fetchAirQuality: options?.fetchAirQuality ?? vi.fn(async () => createUpstreamPayload(35)),
    checkAvailability: async () => true,
  };

  const geocodingProvider: GeocodingProvider = {
    geocodeLocation: vi.fn(async ({ city, country }) => ({
      resolvedLabel: `${city}, ${country}`,
      country,
      latitude: 50.061,
      longitude: 19.937,
      timezone: 'Europe/Warsaw',
    })),
  };

  const config = loadConfig({
    NODE_ENV: 'test',
    ADMIN_EMAILS: 'admin@example.org',
    COORDINATOR_EMAILS: 'coord@example.org',
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
    ...(options?.cacheRepository ? { airQualityCacheRepository: options.cacheRepository } : {}),
    ...(options?.rateLimitMaxRequests !== undefined
      ? { rateLimitMaxRequests: options.rateLimitMaxRequests }
      : {}),
  });
}

describe('Phase 5 Sustainable Alternatives API routes integration', () => {
  it('enforces authentication, email verification, and household profile prerequisites', async () => {
    const app = createAlternativesTestApp();

    const unauth = await request(app).get('/api/v1/alternatives/recommendations');
    expect(unauth.status).toBe(401);

    const unverified = await request(app)
      .get('/api/v1/alternatives/recommendations')
      .set('Authorization', 'Bearer token-unverified');
    expect(unverified.status).toBe(403);
    expect(unverified.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const noProfile = await request(app)
      .get('/api/v1/alternatives/recommendations')
      .set('Authorization', 'Bearer token-alice');
    expect(noProfile.status).toBe(404);
  });

  it('rejects IDOR parameters and returns tailored recommendations, comparison, and refresh flows', async () => {
    const app = createAlternativesTestApp();

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE)
      .expect(200);

    // Reject unknown userId query param
    const idorAttempt = await request(app)
      .get('/api/v1/alternatives/recommendations?userId=uid_other')
      .set('Authorization', 'Bearer token-alice');
    expect(idorAttempt.status).toBe(400);

    // Get default tailored recommendations
    const recRes = await request(app)
      .get('/api/v1/alternatives/recommendations')
      .set('Authorization', 'Bearer token-alice');
    expect(recRes.status).toBe(200);
    expect(recRes.body.data.cachedResult).toBe(false);
    expect(recRes.body.data.overview.countsByCategory.transportation).toBeGreaterThanOrEqual(3);
    expect(recRes.body.data.overview.countsByImpact.broader_sustainability).toBeGreaterThanOrEqual(
      1,
    );
    expect(recRes.body.data.featuredComparison).not.toBeNull();

    // Subsequent identical request hits cache
    const cachedRes = await request(app)
      .get('/api/v1/alternatives/recommendations')
      .set('Authorization', 'Bearer token-alice');
    expect(cachedRes.status).toBe(200);
    expect(cachedRes.body.data.cachedResult).toBe(true);

    // Filtered recommendations
    const filteredRes = await request(app)
      .get(
        '/api/v1/alternatives/recommendations?category=consumption_waste&affordability=zero_cost',
      )
      .set('Authorization', 'Bearer token-alice');
    expect(filteredRes.status).toBe(200);
    expect(
      filteredRes.body.data.alternatives.every(
        (item: { category: string; affordabilityTier: string }) =>
          item.category === 'consumption_waste' && item.affordabilityTier === 'zero_cost',
      ),
    ).toBe(true);

    // Compare endpoint with explicit baseline option
    const compareRes = await request(app)
      .get(
        '/api/v1/alternatives/compare?alternativeId=transport-public-transit&currentOption=solo_gas_vehicle',
      )
      .set('Authorization', 'Bearer token-alice');
    expect(compareRes.status).toBe(200);
    expect(compareRes.body.data.alternativeId).toBe('transport-public-transit');
    expect(compareRes.body.data.selectedBaselineId).toBe('solo_gas_vehicle');

    // Unknown alternativeId returns 404
    const unknownCompare = await request(app)
      .get('/api/v1/alternatives/compare?alternativeId=nonexistent-alternative')
      .set('Authorization', 'Bearer token-alice');
    expect(unknownCompare.status).toBe(404);

    // Refresh invalidates owner cache cleanly
    const refreshRes = await request(app)
      .post('/api/v1/alternatives/refresh')
      .set('Authorization', 'Bearer token-alice')
      .send({ forceRefresh: true });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.cachedResult).toBe(false);
  });

  it('handles stale and unavailable outdoor air quality transparently without fabricating active travel suitability', async () => {
    let now = 10_000;
    const aqCache = new AirQualityCacheRepository({
      cacheTtlMs: 1_000,
      staleTtlMs: 60_000,
      geocodeTtlMs: 60_000,
      nowMs: () => now,
    });
    let shouldFail = false;

    const app = createAlternativesTestApp({
      cacheRepository: aqCache,
      fetchAirQuality: vi.fn(async () => {
        if (shouldFail) {
          throw new Error('Upstream offline');
        }
        return createUpstreamPayload(180);
      }),
    });

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE)
      .expect(200);

    // High AQI turns active travel into not_advised_now
    const highRes = await request(app)
      .get('/api/v1/alternatives/recommendations')
      .set('Authorization', 'Bearer token-alice')
      .expect(200);

    const highActive = highRes.body.data.alternatives.find(
      (item: { id: string }) => item.id === 'transport-active-travel-aqi-aware',
    );
    expect(highActive.suitabilityStatus).toBe('not_advised_now');

    // Advance past fresh TTL and fail upstream -> stale disclosure
    now += 5_000;
    shouldFail = true;
    const staleRes = await request(app)
      .post('/api/v1/alternatives/refresh')
      .set('Authorization', 'Bearer token-alice')
      .send({ forceRefresh: true })
      .expect(200);
    expect(staleRes.body.data.airQualityContext.transparency.freshnessStatus).toBe('stale');

    // Advance past stale TTL -> unavailable disclosure & conditional active travel
    now += 120_000;
    const unavailableRes = await request(app)
      .post('/api/v1/alternatives/refresh')
      .set('Authorization', 'Bearer token-alice')
      .send({ forceRefresh: true })
      .expect(200);
    expect(unavailableRes.body.data.airQualityContext.transparency.freshnessStatus).toBe(
      'unavailable',
    );
    const unavailableActive = unavailableRes.body.data.alternatives.find(
      (item: { id: string }) => item.id === 'transport-active-travel-aqi-aware',
    );
    expect(unavailableActive.suitabilityStatus).toBe('conditional');
  });
});
