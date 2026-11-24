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
  GeminiTimeoutError,
  type GeminiAdvisoryClient,
} from '../../src/services/ai/geminiClient.ts';
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

function createUpstreamPayload(usAqiValue = 182): RawOpenMeteoAirQualityResponse {
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

function createAdvisoryTestApp(options?: {
  readonly geminiClient?: GeminiAdvisoryClient;
  readonly fetchAirQuality?: AirQualityProvider['fetchAirQuality'];
  readonly cacheRepository?: AirQualityCacheRepository;
  readonly advisoryRateLimitMaxRequests?: number;
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
    fetchAirQuality: options?.fetchAirQuality ?? vi.fn(async () => createUpstreamPayload(182)),
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
    GEMINI_API_KEY: 'test-server-only-gemini-secret-value',
    ADMIN_EMAILS: 'admin@example.org',
    COORDINATOR_EMAILS: 'coord@example.org',
  });

  const defaultGeminiClient: GeminiAdvisoryClient = options?.geminiClient ?? {
    model: 'gemini-4-hydrogen',
    isConfigured: () => true,
    generateStructuredJson: vi.fn(async ({ prompt }) => {
      if (prompt.includes('"task": "personalized_daily_briefing"')) {
        return {
          rawText: JSON.stringify({
            headline: 'Protect indoor air and bundle essential car errands in Krakow',
            summary:
              'Unhealthy outdoor PM2.5 favors shifting active outdoor play indoors while combining short car trips.',
            outdoorInfluenceSummary:
              'US AQI 182 and European AQI 86 indicate high particulate burden across Krakow.',
            indoorContextSummary:
              'No indoor sensors are connected; guidance relies on your natural-window profile.',
            priorityActions: [
              {
                recommendationId: 'transport-trip-chaining-no-idling',
                sourceModule: 'alternatives',
                title: 'Combine short gas-vehicle errands',
                rationale: 'Lowers cold-start tailpipe exhaust without extra outdoor exertion.',
                impactCategory: 'local_emissions',
              },
            ],
            cautionsAndLimitations:
              'Educational lifestyle guidance only; maintain working smoke and carbon monoxide alarms.',
            evidenceRefIds: ['EV-OPEN-METEO', 'EV-EPA-AQI'],
          }),
          model: 'gemini-4-hydrogen',
          totalTokens: 210,
          attempts: 1,
        };
      }

      if (prompt.includes('"task": "why_this_recommendation_and_impact_explanation"')) {
        return {
          rawText: JSON.stringify({
            headline: 'Why combining car errands lowers street-level exhaust',
            contextualSummary:
              'Bundling short household drives cuts repeated cold-start combustion plumes.',
            whyThisAppliesToHousehold:
              'Matches your saved gas-vehicle commute for a 4-person household in Krakow.',
            impactExplanation: {
              action:
                'Group errands into one continuous loop and switch off ignition while parked.',
              reason: 'Cold-start engines emit higher tailpipe nitrogen oxides and soot.',
              expectedBenefit:
                'Reduces local neighborhood exhaust emissions without exposing family members outdoors.',
              impactCategory: 'local_emissions',
              evidence: 'US EPA transportation emissions guidance and Open-Meteo outdoor context.',
              limitations:
                'Does not remove outdoor PM2.5 already trapped in the Krakow valley basin.',
            },
            alternativeOrTradeoffNote: 'Requires advance household trip scheduling.',
            evidenceRefIds: ['EV-ALT-TRANSPORT-TRIP-CHAINING-NO-IDLING', 'EV-OPEN-METEO'],
          }),
          model: 'gemini-4-hydrogen',
          totalTokens: 185,
          attempts: 1,
        };
      }

      return {
        rawText: JSON.stringify({
          headline: 'Bundled trips vs. separate cold-start car runs',
          summary:
            'Combining errands cuts repeated cold-start tailpipe emissions compared with daily solo trips.',
          currentChoiceImpact:
            'Separate cold-start drives elevate localized NO2 and CO near residential curbs.',
          suggestedChoiceImpact:
            'Warm-engine trip chaining reduces cold-start bursts and eliminates stationary idling.',
          impactCategory: 'local_emissions',
          whyPreferableForHousehold:
            'Directly cuts local vehicle exhaust while avoiding high-exertion outdoor walking under US AQI 182.',
          tradeoffsAndLimitations:
            'Requires grouping schedules; does not guarantee immediate neighborhood AQI drops.',
          evidenceRefIds: ['EV-ALT-TRANSPORT-TRIP-CHAINING-NO-IDLING', 'EV-OPEN-METEO'],
        }),
        model: 'gemini-4-hydrogen',
        totalTokens: 170,
        attempts: 1,
      };
    }),
  };

  return createApp({
    config,
    tokenVerifier,
    roleResolver: new ServerConfiguredRoleResolver({
      adminEmails: ['admin@example.org'],
      coordinatorEmails: ['coord@example.org'],
    }),
    airQualityProvider,
    geocodingProvider,
    geminiClient: defaultGeminiClient,
    ...(options?.cacheRepository ? { airQualityCacheRepository: options.cacheRepository } : {}),
    ...(options?.advisoryRateLimitMaxRequests !== undefined
      ? { advisoryRateLimitMaxRequests: options.advisoryRateLimitMaxRequests }
      : {}),
  });
}

describe('Phase 6 GenAI Personalization & Impact Explanation API routes', () => {
  it('enforces authentication, email verification, profile prerequisites, and strict Zod/IDOR checks', async () => {
    const app = createAdvisoryTestApp();

    const unauth = await request(app).get('/api/v1/advisory/briefing');
    expect(unauth.status).toBe(401);

    const unverified = await request(app)
      .get('/api/v1/advisory/briefing')
      .set('Authorization', 'Bearer token-unverified');
    expect(unverified.status).toBe(403);
    expect(unverified.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const noProfile = await request(app)
      .get('/api/v1/advisory/briefing')
      .set('Authorization', 'Bearer token-alice');
    expect(noProfile.status).toBe(404);

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE)
      .expect(200);

    const idorQuery = await request(app)
      .get('/api/v1/advisory/briefing?userId=uid_bob')
      .set('Authorization', 'Bearer token-alice');
    expect(idorQuery.status).toBe(400);

    const idorBody = await request(app)
      .post('/api/v1/advisory/explain-recommendation')
      .set('Authorization', 'Bearer token-alice')
      .send({
        recommendationId: 'transport-trip-chaining-no-idling',
        sourceModule: 'alternatives',
        ownerUid: 'uid_bob',
      });
    expect(idorBody.status).toBe(400);
  });

  it('serves grounded Gemini briefing, 6-part impact explanation, choice comparison, caching, refresh, and metrics without leaking API keys', async () => {
    const app = createAdvisoryTestApp();

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE)
      .expect(200);

    const briefingRes = await request(app)
      .get('/api/v1/advisory/briefing')
      .set('Authorization', 'Bearer token-alice')
      .expect(200);

    expect(briefingRes.body.data.generationMeta.generationMode).toBe('gemini');
    expect(briefingRes.body.data.generationMeta.cachedResult).toBe(false);
    expect(briefingRes.body.data.verifiedEvidence.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(briefingRes.body)).not.toContain('test-server-only-gemini-secret-value');

    // Second GET hits cache
    const cachedBriefing = await request(app)
      .get('/api/v1/advisory/briefing')
      .set('Authorization', 'Bearer token-alice')
      .expect(200);
    expect(cachedBriefing.body.data.generationMeta.cachedResult).toBe(true);

    // Explain recommendation (6-part impact explanation)
    const explainRes = await request(app)
      .post('/api/v1/advisory/explain-recommendation')
      .set('Authorization', 'Bearer token-alice')
      .send({
        recommendationId: 'transport-trip-chaining-no-idling',
        sourceModule: 'alternatives',
        focus: 'emissions',
      })
      .expect(200);
    expect(explainRes.body.data.generationMeta.generationMode).toBe('gemini');
    expect(explainRes.body.data.impactExplanation.impactCategory).toBe('local_emissions');
    expect(explainRes.body.data.impactExplanation.limitations).toBeTruthy();

    // Unknown recommendation returns 404
    const unknownExplain = await request(app)
      .post('/api/v1/advisory/explain-recommendation')
      .set('Authorization', 'Bearer token-alice')
      .send({
        recommendationId: 'does-not-exist',
        sourceModule: 'alternatives',
      });
    expect(unknownExplain.status).toBe(404);

    // Compare choices
    const compareRes = await request(app)
      .post('/api/v1/advisory/compare-choices')
      .set('Authorization', 'Bearer token-alice')
      .send({
        alternativeId: 'transport-trip-chaining-no-idling',
        currentOption: 'separate_cold_trips',
      })
      .expect(200);
    expect(compareRes.body.data.generationMeta.generationMode).toBe('gemini');
    expect(compareRes.body.data.impactCategory).toBe('local_emissions');

    // Refresh clears owner cache
    const refreshRes = await request(app)
      .post('/api/v1/advisory/refresh')
      .set('Authorization', 'Bearer token-alice')
      .send({ forceRefresh: true })
      .expect(200);
    expect(refreshRes.body.data.generationMeta.cachedResult).toBe(false);

    // Operational metrics snapshot
    const metricsRes = await request(app)
      .get('/api/v1/advisory/metrics')
      .set('Authorization', 'Bearer token-alice')
      .expect(200);
    expect(metricsRes.body.data.geminiRequests).toBeGreaterThanOrEqual(3);
    expect(metricsRes.body.data.cacheHits).toBeGreaterThanOrEqual(1);
    expect(metricsRes.body.data.totalTokensUsed).toBeGreaterThan(0);
  });

  it('activates deterministic fallback on hallucinated Gemini outputs, timeouts, and unconfigured API keys', async () => {
    // 1. Hallucinated output (unsupported percentage)
    const hallucinatedApp = createAdvisoryTestApp({
      geminiClient: {
        model: 'gemini-4-hydrogen',
        isConfigured: () => true,
        generateStructuredJson: async () => ({
          rawText: JSON.stringify({
            headline: 'Guaranteed 40% reduction',
            summary: 'This reduces neighborhood pollution by 40% overnight.',
            outdoorInfluenceSummary: 'US AQI 182.',
            indoorContextSummary: 'No indoor sensors.',
            priorityActions: [
              {
                recommendationId: 'transport-trip-chaining-no-idling',
                sourceModule: 'alternatives',
                title: 'Bundle errands',
                rationale: 'Lowers exhaust.',
                impactCategory: 'local_emissions',
              },
            ],
            cautionsAndLimitations: 'Educational household guidance only.',
            evidenceRefIds: ['EV-OPEN-METEO'],
          }),
          model: 'gemini-4-hydrogen',
          totalTokens: 50,
          attempts: 1,
        }),
      },
    });

    await request(hallucinatedApp)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE)
      .expect(200);

    const hallucinatedFallback = await request(hallucinatedApp)
      .get('/api/v1/advisory/briefing')
      .set('Authorization', 'Bearer token-alice')
      .expect(200);
    expect(hallucinatedFallback.body.data.generationMeta.generationMode).toBe(
      'deterministic_fallback',
    );
    expect(hallucinatedFallback.body.data.generationMeta.fallbackReason).toMatch(/percentage/i);

    // 2. Timeout error triggers fallback + records timeout metric
    const timeoutApp = createAdvisoryTestApp({
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
      .send(SAVED_HOUSEHOLD_PROFILE)
      .expect(200);

    const timeoutRes = await request(timeoutApp)
      .post('/api/v1/advisory/explain-recommendation')
      .set('Authorization', 'Bearer token-alice')
      .send({
        recommendationId: 'transport-trip-chaining-no-idling',
        sourceModule: 'alternatives',
      })
      .expect(200);
    expect(timeoutRes.body.data.generationMeta.generationMode).toBe('deterministic_fallback');
    expect(timeoutRes.body.data.generationMeta.fallbackReason).toMatch(/timeout/i);

    const metricsRes = await request(timeoutApp)
      .get('/api/v1/advisory/metrics')
      .set('Authorization', 'Bearer token-alice')
      .expect(200);
    expect(metricsRes.body.data.timeouts).toBe(1);
    expect(metricsRes.body.data.fallbackCount).toBe(1);

    // 3. Unconfigured Gemini client uses clean deterministic fallback
    const unconfiguredApp = createAdvisoryTestApp({
      geminiClient: {
        model: 'gemini-4-hydrogen',
        isConfigured: () => false,
        generateStructuredJson: vi.fn(),
      },
    });

    await request(unconfiguredApp)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE)
      .expect(200);

    const unconfiguredRes = await request(unconfiguredApp)
      .post('/api/v1/advisory/compare-choices')
      .set('Authorization', 'Bearer token-alice')
      .send({ alternativeId: 'transport-trip-chaining-no-idling' })
      .expect(200);
    expect(unconfiguredRes.body.data.generationMeta.generationMode).toBe('deterministic_fallback');
  });

  it('discloses stale/unavailable outdoor data honestly and enforces dedicated AI rate limiting (429)', async () => {
    let now = 10_000;
    const aqCache = new AirQualityCacheRepository({
      cacheTtlMs: 1_000,
      staleTtlMs: 5_000,
      geocodeTtlMs: 60_000,
      nowMs: () => now,
    });
    let failUpstream = false;

    const app = createAdvisoryTestApp({
      cacheRepository: aqCache,
      advisoryRateLimitMaxRequests: 3,
      fetchAirQuality: async () => {
        if (failUpstream) {
          throw new Error('Upstream offline');
        }
        return createUpstreamPayload(182);
      },
    });

    await request(app)
      .put('/api/v1/household/profile')
      .set('Authorization', 'Bearer token-alice')
      .send(SAVED_HOUSEHOLD_PROFILE)
      .expect(200);

    // Prime fresh air quality cache
    await request(app)
      .get('/api/v1/advisory/briefing')
      .set('Authorization', 'Bearer token-alice')
      .expect(200);

    // Advance past stale TTL -> unavailable disclosure
    now += 20_000;
    failUpstream = true;
    const unavailableRes = await request(app)
      .post('/api/v1/advisory/refresh')
      .set('Authorization', 'Bearer token-alice')
      .send({ forceRefresh: true })
      .expect(200);
    expect(unavailableRes.body.data.generationMeta.freshnessDisclosure).toBe('unavailable');
    expect(unavailableRes.body.data.generationMeta.freshnessMessage).toMatch(/unavailable/i);

    // Request 3 hits limit boundary or passes, request 4 exceeds AI rate limit of 3
    await request(app)
      .get('/api/v1/advisory/briefing')
      .set('Authorization', 'Bearer token-alice')
      .expect(200);

    const rateLimited = await request(app)
      .get('/api/v1/advisory/briefing')
      .set('Authorization', 'Bearer token-alice');
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.body.error.code).toBe('RATE_LIMITED');
  });
});
