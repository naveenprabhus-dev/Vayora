import type {
  AirQualityCurrentResponse,
  HouseholdLifestyleRecord,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import { describe, expect, it } from 'vitest';
import { AlternativesCacheRepository } from '../../src/modules/alternatives/alternatives.cache.ts';
import {
  countByCategory,
  countByImpact,
  filterAlternatives,
  generateSustainableAlternativesCatalog,
} from '../../src/modules/alternatives/utils/alternatives-engine.ts';
import { buildAlternativeComparison } from '../../src/modules/alternatives/utils/comparison-engine.ts';
import { evaluateAirQualityForRoutines } from '../../src/modules/routines/utils/routine-aq-evaluator.ts';

function buildHouseholdProfile(
  overrides?: Partial<HouseholdLifestyleRecord>,
): HouseholdLifestyleRecord {
  return {
    ownerUid: 'uid_alt_family',
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
    heatingType: 'solid_fuel',
    lifestylePreferences: {
      preferredGuidanceFocus: 'balanced',
      reminderCadence: 'daily_smog_alerts',
    },
    onboardingCompleted: true,
    ...overrides,
  };
}

function buildOutdoorSnapshot(options?: {
  readonly level?: 'low' | 'moderate' | 'high' | 'unavailable';
  readonly freshness?: 'fresh' | 'stale' | 'unavailable';
}): AirQualityCurrentResponse {
  const level = options?.level ?? 'low';
  const freshness = options?.freshness ?? (level === 'unavailable' ? 'unavailable' : 'fresh');
  const isUnavailable = level === 'unavailable' || freshness === 'unavailable';
  const usValue = isUnavailable ? null : level === 'low' ? 28 : level === 'moderate' ? 88 : 182;
  const euValue = isUnavailable ? null : level === 'low' ? 16 : level === 'moderate' ? 50 : 90;

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
        meaning: 'Test AQI meaning',
        precautionSummary: 'Test precaution',
        methodologyNote: 'US EPA',
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
              ? 'Fair'
              : 'Poor',
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
        precautionSummary: 'Test precaution',
        methodologyNote: 'EEA',
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
            code: 'pm2_5',
            abbreviation: 'PM2.5',
            fullName: 'Fine Particulate Matter',
            basis: 'provider_sub_index',
            estimatedSubIndex: usValue,
            explanation: 'PM2.5 dominates.',
          },
    },
    pollutants: [],
    forecastPreview: [],
    guidance: {
      status: 'measured_evidence',
      headline: 'Test guidance',
      summary: 'Test summary',
      fogDistinctionNote: 'Fog distinction note',
      guidanceScopeNote: 'Educational scope note',
      actions: [],
    },
    transparency: {
      providerId: 'open-meteo',
      providerName: 'Open-Meteo Air Quality',
      dataNature: isUnavailable ? 'unavailable' : 'model_forecast',
      dataNatureDisclosure: 'Model-derived forecast.',
      attribution: 'Data provided by Open-Meteo.com (CC BY 4.0)',
      freshnessStatus: freshness,
      availabilityStatus: isUnavailable ? 'unavailable' : 'available',
      observationTimestamp: isUnavailable ? null : '2026-11-23T09:00:00Z',
      fetchedAt: '2026-11-23T09:01:00Z',
      cacheAgeSeconds: freshness === 'stale' ? 2400 : 12,
      fallbackActive: freshness !== 'fresh',
      fallbackReason: freshness === 'stale' ? 'Cached reading in use.' : null,
      methodologySummary: 'Independent AQI scales.',
    },
  };
}

describe('Phase 5 Sustainable Alternatives Engine', () => {
  it('generates alternatives across all four categories and all four impact classifications', () => {
    const profile = buildHouseholdProfile();
    const snapshot = buildOutdoorSnapshot({ level: 'low' });
    const aqState = evaluateAirQualityForRoutines(snapshot);

    const catalog = generateSustainableAlternativesCatalog({
      profile,
      aqState,
      location: snapshot.location,
    });

    const byCategory = countByCategory(catalog);
    expect(byCategory.transportation).toBeGreaterThanOrEqual(3);
    expect(byCategory.household_energy_heating).toBeGreaterThanOrEqual(1);
    expect(byCategory.everyday_activities).toBeGreaterThanOrEqual(2);
    expect(byCategory.consumption_waste).toBeGreaterThanOrEqual(2);

    const byImpact = countByImpact(catalog);
    expect(byImpact.local_emissions).toBeGreaterThanOrEqual(1);
    expect(byImpact.personal_exposure).toBeGreaterThanOrEqual(1);
    expect(byImpact.both_exposure_and_emissions).toBeGreaterThanOrEqual(1);
    expect(byImpact.broader_sustainability).toBeGreaterThanOrEqual(1);

    // Every item must carry verified public agency evidence + no fabricated percentage savings
    for (const item of catalog) {
      expect(item.evidenceReference.sourceUrl).toMatch(/^https:\/\//);
      expect(item.evidenceReference.limitations.length).toBeGreaterThan(20);
      expect(item.ghgVsLocalPollutantNote.length).toBeGreaterThan(20);
      expect(item.qualitativeComparisonNote.length).toBeGreaterThan(20);
    }
  });

  it('switches active transport suitability dynamically with outdoor AQI conditions', () => {
    const profile = buildHouseholdProfile({ primaryCommuteMode: 'gas_vehicle' });

    const cleanSnapshot = buildOutdoorSnapshot({ level: 'low' });
    const cleanActive = generateSustainableAlternativesCatalog({
      profile,
      aqState: evaluateAirQualityForRoutines(cleanSnapshot),
      location: cleanSnapshot.location,
    }).find((item) => item.id === 'transport-active-travel-aqi-aware');
    expect(cleanActive?.suitabilityStatus).toBe('recommended');
    expect(cleanActive?.impactClassification).toBe('both_exposure_and_emissions');

    const moderateSnapshot = buildOutdoorSnapshot({ level: 'moderate' });
    const moderateActive = generateSustainableAlternativesCatalog({
      profile,
      aqState: evaluateAirQualityForRoutines(moderateSnapshot),
      location: moderateSnapshot.location,
    }).find((item) => item.id === 'transport-active-travel-aqi-aware');
    expect(moderateActive?.suitabilityStatus).toBe('conditional');
    expect(moderateActive?.impactClassification).toBe('personal_exposure');

    const highSnapshot = buildOutdoorSnapshot({ level: 'high' });
    const highActive = generateSustainableAlternativesCatalog({
      profile,
      aqState: evaluateAirQualityForRoutines(highSnapshot),
      location: highSnapshot.location,
    }).find((item) => item.id === 'transport-active-travel-aqi-aware');
    expect(highActive?.suitabilityStatus).toBe('not_advised_now');
    expect(highActive?.suitabilityReason).toMatch(/Not advised/i);

    const unavailableSnapshot = buildOutdoorSnapshot({ level: 'unavailable' });
    const unavailableActive = generateSustainableAlternativesCatalog({
      profile,
      aqState: evaluateAirQualityForRoutines(unavailableSnapshot),
      location: unavailableSnapshot.location,
    }).find((item) => item.id === 'transport-active-travel-aqi-aware');
    expect(unavailableActive?.suitabilityStatus).toBe('conditional');
    expect(unavailableActive?.suitabilityReason).toMatch(/unavailable/i);
  });

  it('explicitly separates broader sustainability from immediate local air quality', () => {
    const profile = buildHouseholdProfile({
      primaryCommuteMode: 'public_transit',
      heatingType: 'district',
    });
    const snapshot = buildOutdoorSnapshot({ level: 'low' });
    const catalog = generateSustainableAlternativesCatalog({
      profile,
      aqState: evaluateAirQualityForRoutines(snapshot),
      location: snapshot.location,
    });

    // Transit rider should not get redundant individual-car trip-chaining filler
    expect(catalog.find((item) => item.id === 'transport-trip-chaining-no-idling')).toBeUndefined();
    expect(catalog.find((item) => item.id === 'transport-public-transit')).toBeUndefined();

    const reuseItem = catalog.find((item) => item.id === 'consumption-reuse-repair-packaging');
    expect(reuseItem?.impactClassification).toBe('broader_sustainability');
    expect(reuseItem?.directAqVsBroaderNote).toMatch(/does NOT immediately lower/i);
  });

  it('filters accurately across category, affordability, relevance, impactType, and practicality', () => {
    const profile = buildHouseholdProfile();
    const snapshot = buildOutdoorSnapshot({ level: 'low' });
    const catalog = generateSustainableAlternativesCatalog({
      profile,
      aqState: evaluateAirQualityForRoutines(snapshot),
      location: snapshot.location,
    });

    const filtered = filterAlternatives(catalog, {
      category: 'consumption_waste',
      affordability: 'zero_cost',
      impactType: 'broader_sustainability',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('consumption-reuse-repair-packaging');

    const indoorRecommended = filterAlternatives(catalog, {
      relevance: 'indoor',
      practicality: 'recommended',
    });
    expect(indoorRecommended.some((item) => item.id === 'everyday-low-voc-cleaning')).toBe(true);
  });

  it('builds baseline-aware side-by-side comparison views without losing caveats', () => {
    const profile = buildHouseholdProfile();
    const snapshot = buildOutdoorSnapshot({ level: 'low' });
    const catalog = generateSustainableAlternativesCatalog({
      profile,
      aqState: evaluateAirQualityForRoutines(snapshot),
      location: snapshot.location,
    });
    const transitItem = catalog.find((item) => item.id === 'transport-public-transit');
    expect(transitItem).toBeDefined();

    const evComparison = buildAlternativeComparison(transitItem!, 'solo_ev');
    expect(evComparison.selectedBaselineId).toBe('solo_ev');
    expect(evComparison.currentChoiceSummary).toMatch(/battery electric/i);
    expect(evComparison.directAirQualityAndEmissionsEffect).toMatch(
      /Zero tailpipe exhaust locally/i,
    );
    expect(evComparison.infrastructureConditionality).toMatch(/Krowodrza, Krakow/);
  });

  it('honors TTL expiration and owner-scoped invalidation in AlternativesCacheRepository', () => {
    let now = 1_000;
    const cache = new AlternativesCacheRepository({ ttlMs: 1_000, nowMs: () => now });

    const profile = buildHouseholdProfile();
    const snapshot = buildOutdoorSnapshot({ level: 'low' });
    const catalog = generateSustainableAlternativesCatalog({
      profile,
      aqState: evaluateAirQualityForRoutines(snapshot),
      location: snapshot.location,
    });

    const mockPayload: SustainableAlternativesResponse = {
      advisoryId: 'uid_a::hash1',
      generatedAt: '2026-11-23T09:00:00Z',
      cachedResult: false,
      location: snapshot.location,
      overview: {
        headline: 'Test',
        summary: 'Test',
        totalCatalogEvaluated: catalog.length,
        matchedAlternativesCount: catalog.length,
        countsByCategory: countByCategory(catalog),
        countsByImpact: countByImpact(catalog),
        householdSummary: {
          householdSize: 4,
          householdComposition: ['adults'],
          primaryCommuteMode: 'gas_vehicle',
          heatingType: 'solid_fuel',
          ventilationContext: 'natural_windows',
          primaryZoneType: 'valley_basin',
        },
        outdoorConditionSummary: 'Good',
        impactDistinctionLegend: [],
        activeTransportAqiNote: 'Note',
      },
      appliedFilters: {
        category: null,
        affordability: null,
        relevance: null,
        impactType: null,
        practicality: null,
      },
      airQualityContext: {
        usAqi: snapshot.aqi.usAqi,
        europeanAqi: snapshot.aqi.europeanAqi,
        dominantPollutant: snapshot.aqi.dominantPollutant,
        transparency: snapshot.transparency,
      },
      alternatives: catalog,
      featuredComparison: buildAlternativeComparison(catalog[0]!),
      provenanceAndDisclosures: {
        dataSources: [],
        methodologicalPrinciples: [],
        limitationsSummary: 'Limits',
      },
    };

    cache.set('uid_a::hash1', mockPayload);
    cache.set('uid_b::hash1', { ...mockPayload, advisoryId: 'uid_b::hash1' });

    expect(cache.getFresh('uid_a::hash1')?.cachedResult).toBe(true);
    cache.invalidateOwner('uid_a');
    expect(cache.getFresh('uid_a::hash1')).toBeNull();
    expect(cache.getFresh('uid_b::hash1')?.advisoryId).toBe('uid_b::hash1');

    now += 2_000;
    expect(cache.getFresh('uid_b::hash1')).toBeNull();
  });
});
