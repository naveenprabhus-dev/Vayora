import type { AirQualityCurrentResponse, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { describe, expect, it } from 'vitest';
import { RoutinesCacheRepository } from '../../src/modules/routines/routines.cache.ts';
import { buildCommuteStrategy } from '../../src/modules/routines/utils/commute-advisor.ts';
import { selectBetterTimeWindows } from '../../src/modules/routines/utils/forecast-window-selector.ts';
import { evaluateAirQualityForRoutines } from '../../src/modules/routines/utils/routine-aq-evaluator.ts';
import { buildPersonalizedRoutinePeriods } from '../../src/modules/routines/utils/routine-rule-engine.ts';

function buildHouseholdProfile(
  overrides?: Partial<HouseholdLifestyleRecord>,
): HouseholdLifestyleRecord {
  return {
    ownerUid: 'uid_family_1',
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
    ...overrides,
  };
}

function buildAirQualitySnapshot(options?: {
  readonly level?: 'low' | 'moderate' | 'high' | 'unavailable';
  readonly freshness?: 'fresh' | 'stale' | 'unavailable';
  readonly o3High?: boolean;
  readonly no2High?: boolean;
}): AirQualityCurrentResponse {
  const level = options?.level ?? 'moderate';
  const freshness = options?.freshness ?? (level === 'unavailable' ? 'unavailable' : 'fresh');
  const isUnavailable = level === 'unavailable' || freshness === 'unavailable';

  const usValue = isUnavailable ? null : level === 'low' ? 32 : level === 'moderate' ? 88 : 176;
  const euValue = isUnavailable ? null : level === 'low' ? 18 : level === 'moderate' ? 52 : 86;

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
        meaning: 'Test AQI meaning.',
        precautionSummary: 'Test precaution summary.',
        methodologyNote: 'Test methodology note.',
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
        meaning: 'Test EEA meaning.',
        precautionSummary: 'Test EEA precaution.',
        methodologyNote: 'Test EEA methodology.',
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
            explanation: 'Leading pollutant.',
          },
    },
    pollutants: [
      {
        code: 'pm2_5',
        fullName: 'Fine Particulate Matter',
        abbreviation: 'PM2.5',
        concentration: isUnavailable
          ? null
          : level === 'high'
            ? 68.5
            : level === 'low'
              ? 8.1
              : 28.4,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable
          ? 'unavailable'
          : level === 'high'
            ? 'high'
            : level === 'low'
              ? 'low'
              : 'moderate',
        concentrationBandLabel: isUnavailable ? 'Unavailable' : 'Test band',
        explanation: 'Fine particulates.',
        distinctionNote: 'Mass concentration.',
      },
      {
        code: 'no2',
        fullName: 'Nitrogen Dioxide',
        abbreviation: 'NO2',
        concentration: isUnavailable ? null : options?.no2High ? 145 : 32,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable ? 'unavailable' : options?.no2High ? 'high' : 'low',
        concentrationBandLabel: isUnavailable ? 'Unavailable' : 'Test band',
        explanation: 'Traffic gas.',
        distinctionNote: 'Mass concentration.',
      },
      {
        code: 'o3',
        fullName: 'Ground-Level Ozone',
        abbreviation: 'O3',
        concentration: isUnavailable ? null : options?.o3High ? 160 : 38,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable ? 'unavailable' : options?.o3High ? 'high' : 'low',
        concentrationBandLabel: isUnavailable ? 'Unavailable' : 'Test band',
        explanation: 'Ozone.',
        distinctionNote: 'Mass concentration.',
      },
    ],
    forecastPreview: isUnavailable
      ? []
      : [
          {
            timestamp: '2026-11-22T07:00:00Z',
            usAqi: 132,
            europeanAqi: 72,
            pm25: 48,
            pm10: 62,
            no2: 65,
            so2: 12,
            co: 540,
            o3: 24,
            availability: 'available',
          },
          {
            timestamp: '2026-11-22T12:00:00Z',
            usAqi: level === 'high' ? 158 : 64,
            europeanAqi: level === 'high' ? 82 : 42,
            pm25: level === 'high' ? 56 : 19,
            pm10: 36,
            no2: 28,
            so2: 8,
            co: 410,
            o3: options?.o3High ? 160 : 45,
            availability: 'available',
          },
          {
            timestamp: '2026-11-22T13:00:00Z',
            usAqi: level === 'high' ? 154 : 60,
            europeanAqi: level === 'high' ? 80 : 40,
            pm25: level === 'high' ? 54 : 18,
            pm10: 34,
            no2: 26,
            so2: 8,
            co: 400,
            o3: options?.o3High ? 155 : 46,
            availability: 'available',
          },
          {
            timestamp: '2026-11-22T19:00:00Z',
            usAqi: 148,
            europeanAqi: 78,
            pm25: 52,
            pm10: 66,
            no2: 72,
            so2: 14,
            co: 580,
            o3: 22,
            availability: 'available',
          },
        ],
    guidance: {
      status: isUnavailable
        ? 'general_precaution'
        : freshness === 'stale'
          ? 'stale_evidence'
          : 'measured_evidence',
      headline: 'Guidance headline',
      summary: 'Guidance summary',
      fogDistinctionNote: 'Fog distinction',
      guidanceScopeNote: 'Scope note',
      actions: [],
    },
    transparency: {
      providerId: 'open-meteo',
      providerName: 'Open-Meteo',
      dataNature: isUnavailable ? 'unavailable' : 'model_forecast',
      dataNatureDisclosure: 'Model-derived hourly dispersion forecast.',
      attribution: 'Open-Meteo CC BY 4.0',
      freshnessStatus: freshness,
      availabilityStatus: isUnavailable ? 'unavailable' : 'available',
      observationTimestamp: isUnavailable ? null : '2026-11-22T07:00:00Z',
      fetchedAt: '2026-11-22T07:05:00Z',
      cacheAgeSeconds: freshness === 'stale' ? 1800 : 5,
      fallbackActive: freshness !== 'fresh',
      fallbackReason: freshness === 'stale' ? 'Upstream timeout; serving cache.' : null,
      methodologySummary: 'Separate EPA & EEA scales.',
    },
  };
}

describe('Phase 3 Low-Emission Daily Routines Engine (Unit)', () => {
  it('selects comparatively better midday window from forecast and never fabricates windows when forecast is unavailable', () => {
    const aq = buildAirQualitySnapshot({ level: 'moderate' });
    const windows = selectBetterTimeWindows({
      hourly: aq.forecastPreview,
      timezone: 'Europe/Warsaw',
      transparency: aq.transparency,
    });

    expect(windows.status).toBe('available');
    expect(windows.windows.length).toBeGreaterThanOrEqual(1);
    expect(windows.windows[0]?.period).toBe('midday');
    expect(windows.windows[0]?.usAqiMin).toBe(60);

    const unavailableAq = buildAirQualitySnapshot({
      level: 'unavailable',
      freshness: 'unavailable',
    });
    const unavailableWindows = selectBetterTimeWindows({
      hourly: unavailableAq.forecastPreview,
      timezone: 'Europe/Warsaw',
      transparency: unavailableAq.transparency,
    });

    expect(unavailableWindows.status).toBe('unavailable');
    expect(unavailableWindows.windows).toEqual([]);
    expect(unavailableWindows.limitationDisclosure).toContain('cannot be determined or fabricated');
  });

  it('flags stale cached forecasts honestly in window basis and limitation disclosure', () => {
    const staleAq = buildAirQualitySnapshot({ level: 'moderate', freshness: 'stale' });
    const windows = selectBetterTimeWindows({
      hourly: staleAq.forecastPreview,
      timezone: 'Europe/Warsaw',
      transparency: staleAq.transparency,
    });

    expect(windows.status).toBe('stale');
    expect(windows.windows[0]?.dataBasis).toBe('stale_model_forecast');
    expect(windows.limitationDisclosure).toMatch(/stale cached/i);
  });

  it('never recommends cycling or vigorous walking when pollution is high, and distinguishes emissions from exposure', () => {
    const profile = buildHouseholdProfile({ primaryCommuteMode: 'cycling' });
    const highAq = buildAirQualitySnapshot({ level: 'high' });
    const aqState = evaluateAirQualityForRoutines(highAq);
    const windows = selectBetterTimeWindows({
      hourly: highAq.forecastPreview,
      timezone: 'Europe/Warsaw',
      transparency: highAq.transparency,
    });

    const commute = buildCommuteStrategy({
      profile,
      effectiveCommuteMode: 'cycling',
      aqState,
      betterTimeWindows: windows,
    });

    expect(commute.exposureVsEmissionsNote).toMatch(
      /does not automatically lower personal inhalation exposure/i,
    );
    const activeBlocked = commute.options.find(
      (opt) => opt.id === 'commute-active-travel-unavailable',
    );
    expect(activeBlocked).toBeDefined();
    expect(activeBlocked?.status).toBe('unavailable');
    expect(activeBlocked?.impactType).toBe('exposure_reduction');
  });

  it('does not assume local transit or cycling paths exist without local verification', () => {
    const profile = buildHouseholdProfile({ primaryCommuteMode: 'gas_vehicle' });
    const lowAq = buildAirQualitySnapshot({ level: 'low' });
    const aqState = evaluateAirQualityForRoutines(lowAq);
    const windows = selectBetterTimeWindows({
      hourly: lowAq.forecastPreview,
      timezone: 'Europe/Warsaw',
      transparency: lowAq.transparency,
    });

    const commute = buildCommuteStrategy({
      profile,
      effectiveCommuteMode: 'gas_vehicle',
      aqState,
      betterTimeWindows: windows,
    });

    const transitOption = commute.options.find(
      (opt) => opt.id === 'commute-shift-transit-or-carpool',
    );
    expect(transitOption?.infrastructureNote).toMatch(/exist in your neighborhood/i);
    const activeOption = commute.options.find((opt) => opt.id === 'commute-active-favorable');
    expect(activeOption?.infrastructureNote).toMatch(/safe sidewalks.*exist locally/i);
  });

  it('personalizes rules selectively across households (pets & solid fuel vs urban adult transit) without generating irrelevant cards', () => {
    const aq = buildAirQualitySnapshot({ level: 'moderate' });
    const aqState = evaluateAirQualityForRoutines(aq);
    const windows = selectBetterTimeWindows({
      hourly: aq.forecastPreview,
      timezone: 'Europe/Warsaw',
      transparency: aq.transparency,
    });

    const petSolidFuelProfile = buildHouseholdProfile({
      householdComposition: ['adults', 'pets'],
      outdoorActivityPattern: 'evening_exercise',
      heatingType: 'solid_fuel',
    });
    const adultTransitProfile = buildHouseholdProfile({
      householdSize: 1,
      householdComposition: ['adults'],
      primaryCommuteMode: 'public_transit',
      outdoorActivityPattern: 'morning_commute',
      heatingType: 'district',
      hasIndoorAirPurifier: false,
      ventilationContext: 'mechanical_hvac',
    });

    const petResult = buildPersonalizedRoutinePeriods({
      profile: petSolidFuelProfile,
      effectiveCommuteMode: petSolidFuelProfile.primaryCommuteMode,
      effectiveOutdoorPattern: petSolidFuelProfile.outdoorActivityPattern,
      aqState,
      betterTimeWindows: windows,
    });
    const adultResult = buildPersonalizedRoutinePeriods({
      profile: adultTransitProfile,
      effectiveCommuteMode: adultTransitProfile.primaryCommuteMode,
      effectiveOutdoorPattern: adultTransitProfile.outdoorActivityPattern,
      aqState,
      betterTimeWindows: windows,
    });

    const petIds = petResult.periods.flatMap((p) => p.items.map((i) => i.id));
    const adultIds = adultResult.periods.flatMap((p) => p.items.map((i) => i.id));

    expect(petIds).toContain('morning-pet-walk-routine');
    expect(petIds).toContain('morning-heating-kitchen-habits');
    expect(adultIds).not.toContain('morning-pet-walk-routine');
    expect(adultIds).not.toContain('morning-school-family-routine');
    expect(adultIds).not.toContain('midday-airing-vs-filtration');
  });

  it('adapts scheduling to pollutant-specific O3 elevation and ensures all 5 explanation dimensions without unsupported % claims or medical diagnoses', () => {
    const o3Aq = buildAirQualitySnapshot({ level: 'moderate', o3High: true });
    const aqState = evaluateAirQualityForRoutines(o3Aq);
    const windows = selectBetterTimeWindows({
      hourly: o3Aq.forecastPreview,
      timezone: 'Europe/Warsaw',
      transparency: o3Aq.transparency,
    });
    const profile = buildHouseholdProfile({
      lifestylePreferences: {
        preferredGuidanceFocus: 'low_emission_habits',
        reminderCadence: 'daily_smog_alerts',
      },
    });

    const { periods, overview } = buildPersonalizedRoutinePeriods({
      profile,
      effectiveCommuteMode: profile.primaryCommuteMode,
      effectiveOutdoorPattern: profile.outdoorActivityPattern,
      aqState,
      betterTimeWindows: windows,
    });

    expect(periods.map((p) => p.period)).toEqual(['morning', 'midday', 'evening', 'night']);
    expect(overview.safetyAndScopeNotice).toMatch(/never medical diagnosis/i);

    const middayWindowItem = periods
      .find((p) => p.period === 'midday')
      ?.items.find((i) => i.id === 'midday-forecast-outdoor-window');
    expect(middayWindowItem?.title).toMatch(/ozone/i);

    for (const item of periods.flatMap((p) => p.items)) {
      expect(item.explanation.whatToDo.length).toBeGreaterThan(10);
      expect(item.explanation.whyRecommended.length).toBeGreaterThan(10);
      expect(item.explanation.influencingData.length).toBeGreaterThanOrEqual(2);
      expect(item.explanation.expectedBenefit.length).toBeGreaterThan(10);
      expect(item.explanation.limitationsAndTradeoffs.length).toBeGreaterThan(10);
      expect(item.explanation.expectedBenefit).not.toMatch(/\d+\s*%/);
    }
  });

  it('marks forecast-dependent actions unavailable when live telemetry is unavailable', () => {
    const unavailableAq = buildAirQualitySnapshot({
      level: 'unavailable',
      freshness: 'unavailable',
    });
    const aqState = evaluateAirQualityForRoutines(unavailableAq);
    const windows = selectBetterTimeWindows({
      hourly: unavailableAq.forecastPreview,
      timezone: 'Europe/Warsaw',
      transparency: unavailableAq.transparency,
    });
    const profile = buildHouseholdProfile();

    const { periods, overview } = buildPersonalizedRoutinePeriods({
      profile,
      effectiveCommuteMode: profile.primaryCommuteMode,
      effectiveOutdoorPattern: profile.outdoorActivityPattern,
      aqState,
      betterTimeWindows: windows,
    });

    expect(overview.totalUnavailable).toBeGreaterThanOrEqual(2);
    const middayUnavailable = periods
      .find((p) => p.period === 'midday')
      ?.items.find((i) => i.id === 'midday-forecast-window-unavailable');
    expect(middayUnavailable?.status).toBe('unavailable');
    expect(middayUnavailable?.informationBasis).toBe('unavailable');
  });

  it('prioritizes items based on preferredGuidanceFocus and supports deterministic routine caching', () => {
    const aq = buildAirQualitySnapshot({ level: 'moderate' });
    const aqState = evaluateAirQualityForRoutines(aq);
    const windows = selectBetterTimeWindows({
      hourly: aq.forecastPreview,
      timezone: 'Europe/Warsaw',
      transparency: aq.transparency,
    });

    const commuteFocus = buildHouseholdProfile({
      lifestylePreferences: {
        preferredGuidanceFocus: 'commute_exposure',
        reminderCadence: 'daily_smog_alerts',
      },
    });
    const indoorFocus = buildHouseholdProfile({
      lifestylePreferences: {
        preferredGuidanceFocus: 'indoor_air',
        reminderCadence: 'daily_smog_alerts',
      },
    });

    const commuteRes = buildPersonalizedRoutinePeriods({
      profile: commuteFocus,
      effectiveCommuteMode: commuteFocus.primaryCommuteMode,
      effectiveOutdoorPattern: commuteFocus.outdoorActivityPattern,
      aqState,
      betterTimeWindows: windows,
    });
    const indoorRes = buildPersonalizedRoutinePeriods({
      profile: indoorFocus,
      effectiveCommuteMode: indoorFocus.primaryCommuteMode,
      effectiveOutdoorPattern: indoorFocus.outdoorActivityPattern,
      aqState,
      betterTimeWindows: windows,
    });

    const commuteErrand = commuteRes.periods
      .find((p) => p.period === 'midday')
      ?.items.find((i) => i.id === 'midday-errand-consolidation');
    const indoorErrand = indoorRes.periods
      .find((p) => p.period === 'midday')
      ?.items.find((i) => i.id === 'midday-errand-consolidation');

    expect(commuteErrand?.priorityScore ?? 0).toBeGreaterThan(indoorErrand?.priorityScore ?? 0);

    // Cache hit & expiry test
    let now = 10_000;
    const cache = new RoutinesCacheRepository({ ttlMs: 5_000, nowMs: () => now });
    const fakeResponse = {
      routineId: 'uid_1::abc',
      generatedAt: '2026-11-22T12:00:00Z',
      cachedResult: false,
      location: aq.location,
      profileContext: {
        primaryZoneType: commuteFocus.locationPreferences.primaryZoneType,
        householdSize: commuteFocus.householdSize,
        householdComposition: commuteFocus.householdComposition,
        savedCommuteMode: commuteFocus.primaryCommuteMode,
        effectiveCommuteMode: commuteFocus.primaryCommuteMode,
        savedOutdoorPattern: commuteFocus.outdoorActivityPattern,
        effectiveOutdoorPattern: commuteFocus.outdoorActivityPattern,
        heatingType: commuteFocus.heatingType,
        ventilationContext: commuteFocus.ventilationContext,
        hasIndoorAirPurifier: commuteFocus.hasIndoorAirPurifier,
        preferredGuidanceFocus: commuteFocus.lifestylePreferences.preferredGuidanceFocus,
        isScenarioPreview: false,
      },
      airQualityContext: {
        usAqi: aq.aqi.usAqi,
        europeanAqi: aq.aqi.europeanAqi,
        dominantPollutant: aq.aqi.dominantPollutant,
        pollutants: aq.pollutants,
        transparency: aq.transparency,
      },
      overview: commuteRes.overview,
      betterTimeWindows: windows,
      commuteSummary: buildCommuteStrategy({
        profile: commuteFocus,
        effectiveCommuteMode: commuteFocus.primaryCommuteMode,
        aqState,
        betterTimeWindows: windows,
      }),
      periods: commuteRes.periods,
    };

    cache.set('uid_1::abc', fakeResponse);
    expect(cache.getFresh('uid_1::abc')?.cachedResult).toBe(true);
    now += 6_000;
    expect(cache.getFresh('uid_1::abc')).toBeNull();
  });
});
