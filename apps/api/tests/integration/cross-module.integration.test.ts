import type { HouseholdLifestyleInput } from '@uaqa/contracts';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
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
import type { TokenVerifier } from '../../src/services/auth/tokenVerifier.ts';
import { UnauthorizedError } from '../../src/utils/errors.ts';

function buildHouseholdInput(
  overrides?: Partial<HouseholdLifestyleInput>,
): HouseholdLifestyleInput {
  return {
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
    primaryCommuteMode: 'cycling',
    outdoorActivityPattern: 'school_run_family',
    ventilationContext: 'natural_windows',
    hasIndoorAirPurifier: false,
    heatingType: 'solid_fuel',
    lifestylePreferences: {
      preferredGuidanceFocus: 'balanced',
      reminderCadence: 'daily_smog_alerts',
    },
    onboardingCompleted: true,
    ...overrides,
  };
}

function buildUpstreamAirQuality(cityLat: number): RawOpenMeteoAirQualityResponse {
  const isGdanskClean = cityLat > 53;
  const usAqi = isGdanskClean ? 28 : 182;
  const europeanAqi = isGdanskClean ? 14 : 88;
  const pm25 = isGdanskClean ? 7.2 : 68.5;

  return {
    latitude: cityLat,
    longitude: isGdanskClean ? 18.646 : 19.937,
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
      pm2_5: pm25,
      pm10: isGdanskClean ? 12 : 84,
      nitrogen_dioxide: isGdanskClean ? 11 : 46,
      sulphur_dioxide: 4,
      carbon_monoxide: isGdanskClean ? 190 : 520,
      ozone: 38,
      us_aqi: usAqi,
      european_aqi: europeanAqi,
      us_aqi_pm2_5: usAqi,
      us_aqi_pm10: 15,
      us_aqi_nitrogen_dioxide: 12,
      us_aqi_sulphur_dioxide: 2,
      us_aqi_carbon_monoxide: 4,
      us_aqi_ozone: 18,
    },
    hourly: {
      time: Array.from({ length: 24 }, (_, i) => {
        const hour = (9 + i) % 24;
        const day = 9 + i >= 24 ? '24' : '23';
        return `2026-11-${day}T${String(hour).padStart(2, '0')}:00`;
      }),
      us_aqi: Array.from({ length: 24 }, () => usAqi),
      european_aqi: Array.from({ length: 24 }, () => europeanAqi),
      pm2_5: Array.from({ length: 24 }, () => pm25),
      pm10: Array.from({ length: 24 }, () => (isGdanskClean ? 12 : 84)),
      nitrogen_dioxide: Array.from({ length: 24 }, () => (isGdanskClean ? 11 : 46)),
      sulphur_dioxide: Array.from({ length: 24 }, () => 4),
      carbon_monoxide: Array.from({ length: 24 }, () => (isGdanskClean ? 190 : 520)),
      ozone: Array.from({ length: 24 }, () => 38),
    },
  };
}

function createCrossModuleApp(options?: { readonly geminiFail?: boolean }) {
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
      throw new UnauthorizedError('Invalid test token');
    },
  };

  const airQualityProvider: AirQualityProvider = {
    providerId: 'open-meteo',
    fetchAirQuality: vi.fn(async ({ latitude }) => buildUpstreamAirQuality(latitude)),
    checkAvailability: async () => true,
  };

  const geocodingProvider: GeocodingProvider = {
    geocodeLocation: vi.fn(async ({ city, country }) => ({
      resolvedLabel: `${city}, ${country}`,
      country,
      latitude: city.toLowerCase() === 'gdansk' ? 54.352 : 50.061,
      longitude: city.toLowerCase() === 'gdansk' ? 18.646 : 19.937,
      timezone: 'Europe/Warsaw',
    })),
  };

  const geminiClient: GeminiAdvisoryClient = options?.geminiFail
    ? {
        model: 'gemini-4-hydrogen',
        isConfigured: () => true,
        generateStructuredJson: vi.fn(async () => {
          throw new GeminiTimeoutError(4500);
        }),
      }
    : {
        model: 'gemini-4-hydrogen',
        isConfigured: () => true,
        generateStructuredJson: vi.fn(async ({ prompt }) => {
          if (prompt.includes('"task": "personalized_daily_briefing"')) {
            const isGdansk = prompt.includes('"city": "Gdansk"');
            return {
              rawText: JSON.stringify({
                headline: isGdansk
                  ? 'Enjoy cleaner Baltic coastal conditions in Gdansk'
                  : 'Limit outdoor cycling and protect indoor air in Krakow',
                summary: isGdansk
                  ? 'Low outdoor particulate levels support clean airing and active errands in Gdansk.'
                  : 'Elevated outdoor PM2.5 calls for enclosed transit and indoor source control.',
                outdoorInfluenceSummary: isGdansk
                  ? 'US AQI 28 and European AQI 14 reflect low particulate levels.'
                  : 'US AQI 182 and European AQI 88 reflect elevated particulate levels.',
                indoorContextSummary:
                  'No indoor sensors are connected; guidance reflects your saved home setup.',
                priorityActions: [
                  {
                    recommendationId: 'everyday-avoid-smoke-combustion',
                    sourceModule: 'alternatives',
                    title: 'Replace indoor smoke habits with smoke-free routines',
                    rationale: 'Prevents indoor PM2.5 buildup across household spaces.',
                    impactCategory: 'both',
                  },
                ],
                cautionsAndLimitations:
                  'Educational air-quality guidance only; not medical advice.',
                evidenceRefIds: ['EV-OPEN-METEO', 'EV-EPA-AQI'],
              }),
              model: 'gemini-4-hydrogen',
              totalTokens: 190,
              attempts: 1,
            };
          }
          return {
            rawText: '{}',
            model: 'gemini-4-hydrogen',
            totalTokens: 10,
            attempts: 1,
          };
        }),
      };

  const config = loadConfig({
    NODE_ENV: 'test',
    GEMINI_API_KEY: 'test-server-only-gemini-key',
    ADMIN_EMAILS: 'admin@example.org',
    COORDINATOR_EMAILS: 'coord@example.org',
  });

  return createApp({
    config,
    tokenVerifier,
    airQualityProvider,
    geocodingProvider,
    geminiClient,
  });
}

describe('Phase 7 Cross-Module API Integration, Cache Invalidation & Auth Consistency', () => {
  it('invalidates stale downstream caches and propagates location/profile changes across all 5 modules consistently', async () => {
    const app = createCrossModuleApp();
    const aliceAuth = { Authorization: 'Bearer token-alice' };

    // 1. Save initial Krakow household profile
    await request(app)
      .put('/api/v1/household/profile')
      .set(aliceAuth)
      .send(buildHouseholdInput())
      .expect(200);

    // 2. Populate caches across all 5 modules (cold read -> warm cached read)
    const aqInitial = await request(app)
      .get('/api/v1/air-quality/current')
      .set(aliceAuth)
      .expect(200);
    expect(aqInitial.body.data.location.city).toBe('Krakow');
    expect(aqInitial.body.data.aqi.usAqi.value).toBe(182);
    expect(aqInitial.body.data.aqi.europeanAqi.value).toBe(88);

    await request(app).get('/api/v1/routines/daily').set(aliceAuth).expect(200);
    const routinesCached = await request(app)
      .get('/api/v1/routines/daily')
      .set(aliceAuth)
      .expect(200);
    expect(routinesCached.body.data.cachedResult).toBe(true);

    await request(app).get('/api/v1/indoor-air/guidance').set(aliceAuth).expect(200);
    const indoorCached = await request(app)
      .get('/api/v1/indoor-air/guidance')
      .set(aliceAuth)
      .expect(200);
    expect(indoorCached.body.data.cachedResult).toBe(true);
    expect(indoorCached.body.data.overview.sensorStatus.sensorConnected).toBe(false);

    await request(app).get('/api/v1/alternatives/recommendations').set(aliceAuth).expect(200);
    const altsCached = await request(app)
      .get('/api/v1/alternatives/recommendations')
      .set(aliceAuth)
      .expect(200);
    expect(altsCached.body.data.cachedResult).toBe(true);

    const advisoryInitial = await request(app)
      .get('/api/v1/advisory/briefing')
      .set(aliceAuth)
      .expect(200);
    expect(advisoryInitial.body.data.location.city).toBe('Krakow');
    expect(advisoryInitial.body.data.generationMeta.generationMode).toBe('gemini');

    // 3. Update household preferences & location to Gdansk + heat_pump + purifier
    await request(app)
      .put('/api/v1/household/profile')
      .set(aliceAuth)
      .send(
        buildHouseholdInput({
          city: 'Gdansk',
          neighborhood: 'Wrzeszcz',
          postalPrefix: '80-2',
          locationPreferences: { primaryZoneType: 'suburban_residential', alertsEnabled: true },
          primaryCommuteMode: 'public_transit',
          heatingType: 'heat_pump',
          hasIndoorAirPurifier: true,
        }),
      )
      .expect(200);

    // 4. Subsequent GETs must bypass stale Krakow caches (cachedResult: false) and reflect Gdansk everywhere
    const aqGdansk = await request(app)
      .get('/api/v1/air-quality/current')
      .set(aliceAuth)
      .expect(200);
    expect(aqGdansk.body.data.location.city).toBe('Gdansk');
    expect(aqGdansk.body.data.aqi.usAqi.value).toBe(28);
    expect(aqGdansk.body.data.aqi.europeanAqi.value).toBe(14);

    const routinesGdansk = await request(app)
      .get('/api/v1/routines/daily')
      .set(aliceAuth)
      .expect(200);
    expect(routinesGdansk.body.data.cachedResult).toBe(false);
    expect(routinesGdansk.body.data.location.city).toBe('Gdansk');
    expect(routinesGdansk.body.data.profileContext.heatingType).toBe('heat_pump');

    const indoorGdansk = await request(app)
      .get('/api/v1/indoor-air/guidance')
      .set(aliceAuth)
      .expect(200);
    expect(indoorGdansk.body.data.cachedResult).toBe(false);
    expect(indoorGdansk.body.data.location.city).toBe('Gdansk');
    expect(indoorGdansk.body.data.purifierGuidance.hasPurifier).toBe(true);

    const altsGdansk = await request(app)
      .get('/api/v1/alternatives/recommendations')
      .set(aliceAuth)
      .expect(200);
    expect(altsGdansk.body.data.cachedResult).toBe(false);
    expect(altsGdansk.body.data.location.city).toBe('Gdansk');

    const advisoryGdansk = await request(app)
      .get('/api/v1/advisory/briefing')
      .set(aliceAuth)
      .expect(200);
    expect(advisoryGdansk.body.data.location.city).toBe('Gdansk');
    expect(advisoryGdansk.body.data.headline).toContain('Gdansk');

    // 5. Update monitoring location via PUT /api/v1/air-quality/location back to Krakow and verify invalidation
    await request(app)
      .put('/api/v1/air-quality/location')
      .set(aliceAuth)
      .send({
        country: 'Poland',
        city: 'Krakow',
        neighborhood: 'Kazimierz',
        postalPrefix: '31-05',
      })
      .expect(200);

    const routinesAfterLocUpdate = await request(app)
      .get('/api/v1/routines/daily')
      .set(aliceAuth)
      .expect(200);
    expect(routinesAfterLocUpdate.body.data.cachedResult).toBe(false);
    expect(routinesAfterLocUpdate.body.data.location.city).toBe('Krakow');
    expect(routinesAfterLocUpdate.body.data.location.neighborhood).toBe('Kazimierz');
  });

  it('enforces auth, email verification, and household IDOR isolation across all 5 modules, and keeps deterministic modules intact on Gemini timeout', async () => {
    const app = createCrossModuleApp({ geminiFail: true });
    const protectedEndpoints = [
      '/api/v1/household/profile',
      '/api/v1/air-quality/current',
      '/api/v1/routines/daily',
      '/api/v1/indoor-air/guidance',
      '/api/v1/alternatives/recommendations',
      '/api/v1/advisory/briefing',
    ];

    for (const endpoint of protectedEndpoints) {
      const noToken = await request(app).get(endpoint);
      expect(noToken.status).toBe(401);
      expect(noToken.body.success).toBe(false);

      const unverified = await request(app)
        .get(endpoint)
        .set({ Authorization: 'Bearer token-unverified' });
      expect(unverified.status).toBe(403);
      expect(unverified.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    }

    // Bob cannot read Alice's household profile
    await request(app)
      .put('/api/v1/household/profile')
      .set({ Authorization: 'Bearer token-alice' })
      .send(buildHouseholdInput())
      .expect(200);

    await request(app)
      .get('/api/v1/household/profile/uid_alice')
      .set({ Authorization: 'Bearer token-bob' })
      .expect(403);

    // On Gemini timeout, Phase 2-5 deterministic endpoints stay 200 OK while advisory degrades safely
    const routinesOk = await request(app)
      .get('/api/v1/routines/daily')
      .set({ Authorization: 'Bearer token-alice' })
      .expect(200);
    expect(routinesOk.body.data.overview.headline).toBeTruthy();

    const advisoryFallback = await request(app)
      .get('/api/v1/advisory/briefing')
      .set({ Authorization: 'Bearer token-alice' })
      .expect(200);
    expect(advisoryFallback.body.data.generationMeta.generationMode).toBe('deterministic_fallback');
  });
});
