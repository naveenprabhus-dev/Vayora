import type { AirQualityCurrentResponse, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { describe, expect, it } from 'vitest';
import { IndoorCacheRepository } from '../../src/modules/indoor/indoor.cache.ts';
import { MANDATORY_NO_SENSOR_DISCLOSURE } from '../../src/modules/indoor/indoor.constants.ts';
import {
  buildPersonalizedIndoorActionPlan,
  buildScenarioSummary,
} from '../../src/modules/indoor/utils/indoor-action-plan.ts';
import { getCommonIndoorPollutionSources } from '../../src/modules/indoor/utils/pollution-sources-guide.ts';
import { buildAirPurifierGuidance } from '../../src/modules/indoor/utils/purifier-advisor.ts';
import { buildVentilationGuidance } from '../../src/modules/indoor/utils/ventilation-engine.ts';
import { selectBetterTimeWindows } from '../../src/modules/routines/utils/forecast-window-selector.ts';
import { evaluateAirQualityForRoutines } from '../../src/modules/routines/utils/routine-aq-evaluator.ts';

function buildHouseholdProfile(
  overrides?: Partial<HouseholdLifestyleRecord>,
): HouseholdLifestyleRecord {
  return {
    ownerUid: 'uid_indoor_family',
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
    heatingType: 'district',
    lifestylePreferences: {
      preferredGuidanceFocus: 'indoor_air',
      reminderCadence: 'daily_smog_alerts',
    },
    onboardingCompleted: true,
    ...overrides,
  };
}

function buildOutdoorSnapshot(options?: {
  readonly level?: 'low' | 'moderate' | 'high' | 'unavailable';
  readonly freshness?: 'fresh' | 'stale' | 'unavailable';
  readonly o3High?: boolean;
  readonly no2High?: boolean;
}): AirQualityCurrentResponse {
  const level = options?.level ?? 'moderate';
  const freshness = options?.freshness ?? (level === 'unavailable' ? 'unavailable' : 'fresh');
  const isUnavailable = level === 'unavailable' || freshness === 'unavailable';
  const usValue = isUnavailable ? null : level === 'low' ? 28 : level === 'moderate' ? 82 : 178;
  const euValue = isUnavailable ? null : level === 'low' ? 16 : level === 'moderate' ? 49 : 88;

  return {
    location: {
      city: 'Krakow',
      neighborhood: 'Krowodrza',
      country: 'Poland',
      postalPrefix: '30-01',
      resolvedLabel: 'Krakow, Poland',
      latitude: 50.061,
      longitude: 19.937,
      timezone: 'Europe/Warsaw',
      resolutionSource: 'saved_profile_geocoded',
    },
    aqi: {
      usAqi: {
        scale: 'us_aqi',
        scaleLabel: 'US AQI (EPA)',
        authorityLabel: 'U.S. EPA 0–500 Scale',
        value: usValue,
        status: isUnavailable ? 'unavailable' : 'available',
        category: isUnavailable
          ? 'Unavailable'
          : level === 'low'
            ? 'Good'
            : level === 'moderate'
              ? 'Moderate'
              : 'Unhealthy',
        pollutionLevel: isUnavailable ? 'unavailable' : level,
        pollutionLevelLabel: isUnavailable ? 'Unavailable' : `${level} pollution level`,
        severityToken: isUnavailable
          ? 'unavailable'
          : level === 'low'
            ? 'good'
            : level === 'moderate'
              ? 'moderate'
              : 'high',
        meaning: 'Test meaning',
        precautionSummary: 'Test precaution',
        methodologyNote: 'Test note',
      },
      europeanAqi: {
        scale: 'european_aqi',
        scaleLabel: 'European AQI (EEA)',
        authorityLabel: 'EEA 0–100+ Index',
        value: euValue,
        status: isUnavailable ? 'unavailable' : 'available',
        category: isUnavailable
          ? 'Unavailable'
          : level === 'low'
            ? 'Good'
            : level === 'moderate'
              ? 'Moderate'
              : 'Very poor',
        pollutionLevel: isUnavailable ? 'unavailable' : level,
        pollutionLevelLabel: isUnavailable ? 'Unavailable' : `${level} pollution level`,
        severityToken: isUnavailable
          ? 'unavailable'
          : level === 'low'
            ? 'good'
            : level === 'moderate'
              ? 'moderate'
              : 'high',
        meaning: 'Test EEA meaning',
        precautionSummary: 'Test EEA precaution',
        methodologyNote: 'Test EEA note',
      },
      dominantPollutant: isUnavailable
        ? {
            status: 'unavailable',
            code: null,
            abbreviation: null,
            fullName: null,
            basis: 'unavailable',
            estimatedSubIndex: null,
            explanation: 'Unavailable.',
          }
        : {
            status: 'available',
            code: options?.o3High ? 'o3' : options?.no2High ? 'no2' : 'pm2_5',
            abbreviation: options?.o3High ? 'O3' : options?.no2High ? 'NO2' : 'PM2.5',
            fullName: options?.o3High
              ? 'Ground-Level Ozone'
              : options?.no2High
                ? 'Nitrogen Dioxide'
                : 'Fine Particulate Matter',
            basis: 'provider_sub_index',
            estimatedSubIndex: usValue,
            explanation: 'Primary driver.',
          },
    },
    pollutants: [
      {
        code: 'pm2_5',
        fullName: 'Fine Particulate Matter',
        abbreviation: 'PM2.5',
        concentration: isUnavailable ? null : level === 'high' ? 66 : level === 'low' ? 7 : 26,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable
          ? 'unavailable'
          : level === 'high'
            ? 'high'
            : level === 'low'
              ? 'low'
              : 'moderate',
        concentrationBandLabel: 'Test band',
        explanation: 'Fine particulates.',
        distinctionNote: 'µg/m³',
      },
      {
        code: 'no2',
        fullName: 'Nitrogen Dioxide',
        abbreviation: 'NO2',
        concentration: isUnavailable ? null : options?.no2High ? 140 : 28,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable ? 'unavailable' : options?.no2High ? 'high' : 'low',
        concentrationBandLabel: 'Test band',
        explanation: 'NO2',
        distinctionNote: 'µg/m³',
      },
      {
        code: 'o3',
        fullName: 'Ground-Level Ozone',
        abbreviation: 'O3',
        concentration: isUnavailable ? null : options?.o3High ? 155 : 34,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable ? 'unavailable' : options?.o3High ? 'high' : 'low',
        concentrationBandLabel: 'Test band',
        explanation: 'O3',
        distinctionNote: 'µg/m³',
      },
    ],
    forecastPreview: isUnavailable
      ? []
      : [
          {
            timestamp: '2026-11-22T07:00:00Z',
            usAqi: level === 'low' ? 30 : 120,
            europeanAqi: level === 'low' ? 18 : 66,
            pm25: 42,
            pm10: 54,
            no2: 50,
            so2: 10,
            co: 450,
            o3: 30,
            availability: 'available',
          },
          {
            timestamp: '2026-11-22T12:00:00Z',
            usAqi: level === 'high' ? 168 : level === 'low' ? 24 : 58,
            europeanAqi: level === 'high' ? 84 : level === 'low' ? 15 : 38,
            pm25: level === 'high' ? 60 : 16,
            pm10: 28,
            no2: 24,
            so2: 8,
            co: 390,
            o3: options?.o3High ? 155 : 42,
            availability: 'available',
          },
          {
            timestamp: '2026-11-22T13:00:00Z',
            usAqi: level === 'high' ? 165 : level === 'low' ? 25 : 60,
            europeanAqi: level === 'high' ? 82 : level === 'low' ? 16 : 39,
            pm25: level === 'high' ? 58 : 17,
            pm10: 29,
            no2: 25,
            so2: 8,
            co: 395,
            o3: options?.o3High ? 150 : 41,
            availability: 'available',
          },
        ],
    guidance: {
      status: isUnavailable
        ? 'general_precaution'
        : freshness === 'stale'
          ? 'stale_evidence'
          : 'measured_evidence',
      headline: 'Headline',
      summary: 'Summary',
      fogDistinctionNote: 'Fog note',
      guidanceScopeNote: 'Scope',
      actions: [],
    },
    transparency: {
      providerId: 'open-meteo',
      providerName: 'Open-Meteo',
      dataNature: isUnavailable ? 'unavailable' : 'model_forecast',
      dataNatureDisclosure: 'Model-derived forecast.',
      attribution: 'Open-Meteo CC BY 4.0',
      freshnessStatus: freshness,
      availabilityStatus: isUnavailable ? 'unavailable' : 'available',
      observationTimestamp: isUnavailable ? null : '2026-11-22T07:00:00Z',
      fetchedAt: '2026-11-22T07:05:00Z',
      cacheAgeSeconds: freshness === 'stale' ? 2000 : 10,
      fallbackActive: freshness !== 'fresh',
      fallbackReason: freshness === 'stale' ? 'Serving cached forecast.' : null,
      methodologySummary: 'Separate EPA & EEA scales.',
    },
  };
}

describe('Phase 4 Indoor Air Quality Engine (Unit)', () => {
  it('determines all four ventilation states accurately and respects unsafe-sealing guardrails', () => {
    const profile = buildHouseholdProfile({ heatingType: 'natural_gas' });

    const lowAq = buildOutdoorSnapshot({ level: 'low', freshness: 'fresh' });
    const lowVent = buildVentilationGuidance({
      profile,
      aqState: evaluateAirQualityForRoutines(lowAq),
      betterTimeWindows: selectBetterTimeWindows({
        hourly: lowAq.forecastPreview,
        timezone: 'Europe/Warsaw',
        transparency: lowAq.transparency,
      }),
      scenario: 'baseline',
    });
    expect(lowVent.state).toBe('consider_ventilation');
    expect(lowVent.essentialSafetyReminder).toMatch(/Never seal exterior vents/i);
    expect(lowVent.constraintsAndTradeoffs.join(' ')).toMatch(
      /Low outdoor pollution does not automatically guarantee safe indoor air/i,
    );

    const modAq = buildOutdoorSnapshot({ level: 'moderate', freshness: 'fresh' });
    const modVent = buildVentilationGuidance({
      profile,
      aqState: evaluateAirQualityForRoutines(modAq),
      betterTimeWindows: selectBetterTimeWindows({
        hourly: modAq.forecastPreview,
        timezone: 'Europe/Warsaw',
        transparency: modAq.transparency,
      }),
      scenario: 'baseline',
    });
    expect(modVent.state).toBe('shorter_timed_ventilation');

    const highAq = buildOutdoorSnapshot({ level: 'high', freshness: 'fresh' });
    const highVent = buildVentilationGuidance({
      profile,
      aqState: evaluateAirQualityForRoutines(highAq),
      betterTimeWindows: selectBetterTimeWindows({
        hourly: highAq.forecastPreview,
        timezone: 'Europe/Warsaw',
        transparency: highAq.transparency,
      }),
      scenario: 'baseline',
    });
    expect(highVent.state).toBe('delay_optional_ventilation');

    const unavailAq = buildOutdoorSnapshot({ level: 'unavailable', freshness: 'unavailable' });
    const unavailVent = buildVentilationGuidance({
      profile,
      aqState: evaluateAirQualityForRoutines(unavailAq),
      betterTimeWindows: selectBetterTimeWindows({
        hourly: unavailAq.forecastPreview,
        timezone: 'Europe/Warsaw',
        transparency: unavailAq.transparency,
      }),
      scenario: 'baseline',
    });
    expect(unavailVent.state).toBe('insufficient_data');
    expect(unavailVent.bestWindowHint).toBeNull();
  });

  it('handles stale outdoor data and pollutant-specific NO2/O3 timing considerations', () => {
    const profile = buildHouseholdProfile();
    const staleLowAq = buildOutdoorSnapshot({ level: 'low', freshness: 'stale' });
    const staleVent = buildVentilationGuidance({
      profile,
      aqState: evaluateAirQualityForRoutines(staleLowAq),
      betterTimeWindows: selectBetterTimeWindows({
        hourly: staleLowAq.forecastPreview,
        timezone: 'Europe/Warsaw',
        transparency: staleLowAq.transparency,
      }),
      scenario: 'baseline',
    });
    expect(staleVent.state).toBe('shorter_timed_ventilation');
    expect(staleVent.constraintsAndTradeoffs.join(' ')).toMatch(/stale cache/i);

    const o3Aq = buildOutdoorSnapshot({ level: 'moderate', o3High: true });
    const o3Vent = buildVentilationGuidance({
      profile,
      aqState: evaluateAirQualityForRoutines(o3Aq),
      betterTimeWindows: selectBetterTimeWindows({
        hourly: o3Aq.forecastPreview,
        timezone: 'Europe/Warsaw',
        transparency: o3Aq.transparency,
      }),
      scenario: 'baseline',
    });
    expect(o3Vent.summary).toMatch(/ozone/i);
  });

  it('adapts air purifier guidance for owners vs non-owners without purchase pressure or false gas-removal claims', () => {
    const aq = buildOutdoorSnapshot({ level: 'high' });
    const aqState = evaluateAirQualityForRoutines(aq);

    const ownerProfile = buildHouseholdProfile({ hasIndoorAirPurifier: true });
    const ownerGuidance = buildAirPurifierGuidance({
      profile: ownerProfile,
      aqState,
      scenario: 'baseline',
    });
    expect(ownerGuidance.hasPurifier).toBe(true);
    expect(ownerGuidance.gasAndVocLimitation).toMatch(/does not remove gaseous pollutants/i);
    expect(ownerGuidance.practicalGuidance.join(' ')).toMatch(/manufacturer/i);
    expect(ownerGuidance.practicalGuidance.join(' ')).not.toMatch(/\d+\s*%/);

    const noPurifierProfile = buildHouseholdProfile({
      hasIndoorAirPurifier: false,
      ventilationContext: 'natural_windows',
    });
    const nonOwnerGuidance = buildAirPurifierGuidance({
      profile: noPurifierProfile,
      aqState,
      scenario: 'baseline',
    });
    expect(nonOwnerGuidance.hasPurifier).toBe(false);
    expect(nonOwnerGuidance.nonPurchaseNote).toMatch(/No purchase pressure/i);
    expect(nonOwnerGuidance.gasAndVocLimitation).toMatch(/carbon monoxide/i);

    const simPurifier = buildAirPurifierGuidance({
      profile: noPurifierProfile,
      aqState,
      scenario: 'operating_purifier',
    });
    expect(simPurifier.scenarioSimulatedPurifier).toBe(true);
    expect(simPurifier.headline).toMatch(/Simulated Guidance/i);
  });

  it('covers all 7 mandatory common indoor pollution sources with 5 educational sections and chemical safety guardrails', () => {
    const sources = getCommonIndoorPollutionSources();
    expect(sources).toHaveLength(7);

    const ids = sources.map((s) => s.id);
    expect(ids).toEqual([
      'cooking_emissions',
      'tobacco_or_combustion_smoke',
      'incense_and_candles',
      'cleaning_products_and_aerosols',
      'poorly_maintained_combustion_appliances',
      'dust_and_resuspended_particles',
      'outdoor_infiltration',
    ]);

    for (const source of sources) {
      expect(source.whatItIs.length).toBeGreaterThan(20);
      expect(source.howItAffectsIndoorAir.length).toBeGreaterThan(20);
      expect(source.practicalReductionSteps.length).toBeGreaterThanOrEqual(2);
      expect(source.relevantPrecautions.length).toBeGreaterThanOrEqual(1);
      expect(source.limitations.length).toBeGreaterThan(20);
      expect(source.informationCategory).toBe('general_educational_guidance');
    }

    const cleaningSource = sources.find((s) => s.id === 'cleaning_products_and_aerosols');
    expect(cleaningSource?.relevantPrecautions.join(' ')).toMatch(/NEVER mix cleaning chemicals/i);
  });

  it('personalizes action plan without irrelevant filler items and labels scenarios strictly as simulations', () => {
    const aq = buildOutdoorSnapshot({ level: 'moderate' });
    const aqState = evaluateAirQualityForRoutines(aq);
    const windows = selectBetterTimeWindows({
      hourly: aq.forecastPreview,
      timezone: 'Europe/Warsaw',
      transparency: aq.transparency,
    });

    const electricNoPurifier = buildHouseholdProfile({
      heatingType: 'heat_pump',
      ventilationContext: 'natural_windows',
      hasIndoorAirPurifier: false,
    });
    const minimalPlan = buildPersonalizedIndoorActionPlan({
      profile: electricNoPurifier,
      aqState,
      betterTimeWindows: windows,
      scenario: 'baseline',
    });
    const minimalIds = minimalPlan.map((i) => i.id);
    expect(minimalIds).not.toContain('indoor-hepa-operation-maintenance');
    expect(minimalIds).not.toContain('indoor-hvac-filter-check');

    const solidFuelFiltered = buildHouseholdProfile({
      heatingType: 'solid_fuel',
      ventilationContext: 'filtered_hvac_merv13',
      hasIndoorAirPurifier: true,
    });
    const fullPlan = buildPersonalizedIndoorActionPlan({
      profile: solidFuelFiltered,
      aqState,
      betterTimeWindows: windows,
      scenario: 'cleaning',
    });
    const fullIds = fullPlan.map((i) => i.id);
    expect(fullIds).toContain('indoor-hepa-operation-maintenance');
    expect(fullIds).toContain('indoor-hvac-filter-check');
    expect(fullIds).toContain('indoor-combustion-appliance-safety');

    const scenarioSummary = buildScenarioSummary('cleaning');
    expect(scenarioSummary.isSimulation).toBe(true);
    expect(scenarioSummary.simulationLabel).toMatch(/Simulated activity scenario/i);
    expect(MANDATORY_NO_SENSOR_DISCLOSURE).toContain('Indoor air quality is not being measured.');

    // Cache hit & invalidation verification
    let now = 5_000;
    const cache = new IndoorCacheRepository({ ttlMs: 10_000, nowMs: () => now });
    expect(cache.getFresh('uid_1::abc')).toBeNull();
    cache.set('uid_1::abc', {
      guidanceId: 'uid_1::abc',
      generatedAt: '2026-11-22T12:00:00Z',
      cachedResult: false,
      location: aq.location,
      overview: {
        headline: 'Test',
        summary: 'Test',
        householdSize: 2,
        householdComposition: ['adults'],
        ventilationContext: 'natural_windows',
        hasIndoorAirPurifier: false,
        heatingType: 'district',
        primaryZoneType: 'urban_core',
        outdoorConditionSummary: 'Summary',
        sensorStatus: {
          sensorConnected: false,
          disclosureStatement: MANDATORY_NO_SENSOR_DISCLOSURE,
          evidenceDistinctions: [],
        },
      },
      airQualityContext: {
        usAqi: aq.aqi.usAqi,
        europeanAqi: aq.aqi.europeanAqi,
        dominantPollutant: aq.aqi.dominantPollutant,
        pollutants: aq.pollutants,
        transparency: aq.transparency,
      },
      scenarioContext: scenarioSummary,
      ventilationGuidance: buildVentilationGuidance({
        profile: electricNoPurifier,
        aqState,
        betterTimeWindows: windows,
        scenario: 'baseline',
      }),
      purifierGuidance: buildAirPurifierGuidance({
        profile: electricNoPurifier,
        aqState,
        scenario: 'baseline',
      }),
      actionPlan: minimalPlan,
      pollutionSources: getCommonIndoorPollutionSources(),
      provenanceAndSafety: {
        dataSources: ['Test'],
        nonMedicalNotice: 'Non-medical',
        limitationsSummary: 'Limitations',
      },
    });
    expect(cache.getFresh('uid_1::abc')?.cachedResult).toBe(true);
    now += 15_000;
    expect(cache.getFresh('uid_1::abc')).toBeNull();
  });
});
