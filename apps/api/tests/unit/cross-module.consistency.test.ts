import type {
  AirQualityCurrentResponse,
  DailyRoutineResponse,
  HouseholdLifestyleRecord,
  IndoorAirGuidanceResponse,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import { describe, expect, it } from 'vitest';
import { buildMinimizedAdvisoryContext } from '../../src/modules/advisory/utils/context-minimizer.ts';
import {
  validateGeminiBriefingOutput,
  validateGeminiExplanationOutput,
} from '../../src/modules/advisory/utils/output-validator.ts';
import { generateSustainableAlternativesCatalog } from '../../src/modules/alternatives/utils/alternatives-engine.ts';
import { buildPersonalizedIndoorActionPlan } from '../../src/modules/indoor/utils/indoor-action-plan.ts';
import { buildAirPurifierGuidance } from '../../src/modules/indoor/utils/purifier-advisor.ts';
import { buildVentilationGuidance } from '../../src/modules/indoor/utils/ventilation-engine.ts';
import { buildCommuteStrategy } from '../../src/modules/routines/utils/commute-advisor.ts';
import { selectBetterTimeWindows } from '../../src/modules/routines/utils/forecast-window-selector.ts';
import { evaluateAirQualityForRoutines } from '../../src/modules/routines/utils/routine-aq-evaluator.ts';
import { buildPersonalizedRoutinePeriods } from '../../src/modules/routines/utils/routine-rule-engine.ts';

function createHouseholdProfile(
  overrides?: Partial<HouseholdLifestyleRecord>,
): HouseholdLifestyleRecord {
  return {
    ownerUid: 'uid_cross_module_test',
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

function createAqSnapshot(mode: 'high' | 'unavailable'): AirQualityCurrentResponse {
  const isUnavailable = mode === 'unavailable';
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
        value: isUnavailable ? null : 182,
        status: isUnavailable ? 'unavailable' : 'available',
        category: isUnavailable ? 'Unavailable' : 'Unhealthy',
        pollutionLevel: isUnavailable ? 'unavailable' : 'high',
        pollutionLevelLabel: isUnavailable ? 'Unavailable' : 'High pollution level',
        severityToken: isUnavailable ? 'unavailable' : 'high',
        meaning: isUnavailable ? 'Unavailable.' : 'Elevated PM2.5 particulate concentration.',
        precautionSummary: isUnavailable ? 'Unavailable.' : 'Limit outdoor exertion.',
        methodologyNote: 'Independent EPA scale.',
      },
      europeanAqi: {
        scale: 'european_aqi',
        scaleLabel: 'European AQI (EEA)',
        authorityLabel: 'European Environment Agency (EEA)',
        value: isUnavailable ? null : 88,
        status: isUnavailable ? 'unavailable' : 'available',
        category: isUnavailable ? 'Unavailable' : 'Poor',
        pollutionLevel: isUnavailable ? 'unavailable' : 'high',
        pollutionLevelLabel: isUnavailable ? 'Unavailable' : 'High pollution level',
        severityToken: isUnavailable ? 'unavailable' : 'high',
        meaning: isUnavailable ? 'Unavailable.' : 'Poor EEA air index.',
        precautionSummary: isUnavailable ? 'Unavailable.' : 'Avoid strenuous street exertion.',
        methodologyNote: 'Independent EEA scale.',
      },
      dominantPollutant: isUnavailable
        ? {
            status: 'unavailable',
            code: null,
            abbreviation: null,
            fullName: null,
            basis: 'unavailable',
            estimatedSubIndex: null,
            explanation: 'Telemetry unavailable.',
          }
        : {
            status: 'available',
            code: 'pm2_5',
            abbreviation: 'PM2.5',
            fullName: 'Fine Particulate Matter',
            basis: 'provider_sub_index',
            estimatedSubIndex: 182,
            explanation: 'PM2.5 dominates.',
          },
    },
    pollutants: [
      {
        code: 'pm2_5',
        fullName: 'Fine Particulate Matter',
        abbreviation: 'PM2.5',
        concentration: isUnavailable ? null : 68.5,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable ? 'unavailable' : 'high',
        concentrationBandLabel: isUnavailable ? 'Unavailable' : 'High',
        explanation: 'Fine combustion particles.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
    ],
    forecastPreview: isUnavailable
      ? []
      : [
          {
            timestamp: '2026-11-23T09:00:00Z',
            usAqi: 182,
            europeanAqi: 88,
            pm25: 68.5,
            pm10: 82,
            no2: 45,
            so2: 12,
            co: 480,
            o3: 32,
            availability: 'available',
          },
          {
            timestamp: '2026-11-23T14:00:00Z',
            usAqi: 164,
            europeanAqi: 79,
            pm25: 58.0,
            pm10: 74,
            no2: 40,
            so2: 11,
            co: 450,
            o3: 38,
            availability: 'available',
          },
        ],
    guidance: {
      status: isUnavailable ? 'general_precaution' : 'measured_evidence',
      headline: isUnavailable ? 'Telemetry unavailable' : 'High smog alert',
      summary: isUnavailable ? 'No live data.' : 'Elevated PM2.5.',
      fogDistinctionNote: 'Fog alone does not mean smog.',
      guidanceScopeNote: 'Educational only.',
      actions: [],
    },
    transparency: {
      providerId: 'open-meteo',
      providerName: 'Open-Meteo',
      dataNature: isUnavailable ? 'unavailable' : 'model_forecast',
      dataNatureDisclosure: 'Atmospheric model forecast.',
      attribution: 'Open-Meteo CC BY 4.0',
      freshnessStatus: isUnavailable ? 'unavailable' : 'fresh',
      availabilityStatus: isUnavailable ? 'unavailable' : 'available',
      observationTimestamp: isUnavailable ? null : '2026-11-23T09:00:00Z',
      fetchedAt: '2026-11-23T09:02:00Z',
      cacheAgeSeconds: 0,
      fallbackActive: isUnavailable,
      fallbackReason: isUnavailable ? 'Provider unreachable.' : null,
      methodologySummary: 'Dual EPA & EEA scales.',
    },
  };
}

function composeDeterministicResponses(
  profile: HouseholdLifestyleRecord,
  aq: AirQualityCurrentResponse,
): {
  routines: DailyRoutineResponse;
  indoor: IndoorAirGuidanceResponse;
  alternatives: SustainableAlternativesResponse;
} {
  const aqState = evaluateAirQualityForRoutines(aq);
  const betterWindows = selectBetterTimeWindows({
    hourly: aq.forecastPreview,
    timezone: aq.location.timezone,
    transparency: aq.transparency,
  });
  const commuteSummary = buildCommuteStrategy({
    profile,
    effectiveCommuteMode: profile.primaryCommuteMode,
    aqState,
    betterTimeWindows: betterWindows,
  });
  const { overview: routineOverview, periods } = buildPersonalizedRoutinePeriods({
    profile,
    effectiveCommuteMode: profile.primaryCommuteMode,
    effectiveOutdoorPattern: profile.outdoorActivityPattern,
    aqState,
    betterTimeWindows: betterWindows,
  });

  const routines: DailyRoutineResponse = {
    routineId: 'r-cross',
    generatedAt: '2026-11-23T09:02:00Z',
    cachedResult: false,
    location: aq.location,
    profileContext: {
      primaryZoneType: profile.locationPreferences.primaryZoneType,
      householdSize: profile.householdSize,
      householdComposition: profile.householdComposition,
      savedCommuteMode: profile.primaryCommuteMode,
      effectiveCommuteMode: profile.primaryCommuteMode,
      savedOutdoorPattern: profile.outdoorActivityPattern,
      effectiveOutdoorPattern: profile.outdoorActivityPattern,
      heatingType: profile.heatingType,
      ventilationContext: profile.ventilationContext,
      hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
      preferredGuidanceFocus: profile.lifestylePreferences.preferredGuidanceFocus,
      isScenarioPreview: false,
    },
    airQualityContext: {
      usAqi: aq.aqi.usAqi,
      europeanAqi: aq.aqi.europeanAqi,
      dominantPollutant: aq.aqi.dominantPollutant,
      pollutants: aq.pollutants,
      transparency: aq.transparency,
    },
    overview: routineOverview,
    betterTimeWindows: betterWindows,
    commuteSummary,
    periods,
  };

  const ventilation = buildVentilationGuidance({
    profile,
    aqState,
    betterTimeWindows: betterWindows,
    scenario: 'baseline',
  });
  const purifier = buildAirPurifierGuidance({
    profile,
    aqState,
    scenario: 'baseline',
  });
  const actionPlan = buildPersonalizedIndoorActionPlan({
    profile,
    aqState,
    betterTimeWindows: betterWindows,
    scenario: 'baseline',
  });

  const indoor: IndoorAirGuidanceResponse = {
    guidanceId: 'i-cross',
    generatedAt: '2026-11-23T09:02:00Z',
    cachedResult: false,
    location: aq.location,
    overview: {
      headline: 'Indoor Air Guidance',
      summary: 'Indoor guidance.',
      householdSize: profile.householdSize,
      householdComposition: profile.householdComposition,
      ventilationContext: profile.ventilationContext,
      hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
      heatingType: profile.heatingType,
      primaryZoneType: profile.locationPreferences.primaryZoneType,
      outdoorConditionSummary: aqState.aqContextSummary,
      sensorStatus: {
        sensorConnected: false,
        disclosureStatement: 'No indoor air sensors are connected; indoor guidance is qualitative.',
        evidenceDistinctions: [],
      },
    },
    airQualityContext: routines.airQualityContext,
    scenarioContext: {
      selectedScenario: 'baseline',
      isSimulation: false,
      simulationLabel: 'Baseline',
      scenarioTitle: 'Baseline',
      scenarioDescription: 'Baseline',
      scenarioFocusNotes: [],
      availableScenarios: [],
    },
    ventilationGuidance: ventilation,
    purifierGuidance: purifier,
    actionPlan,
    pollutionSources: [],
    provenanceAndSafety: {
      dataSources: ['Profile', 'Open-Meteo'],
      nonMedicalNotice: 'Educational guidance only.',
      limitationsSummary: 'No indoor sensors.',
    },
  };

  const catalog = generateSustainableAlternativesCatalog({
    profile,
    aqState,
    location: aq.location,
  });

  const alternatives: SustainableAlternativesResponse = {
    advisoryId: 'a-cross',
    generatedAt: '2026-11-23T09:02:00Z',
    cachedResult: false,
    location: aq.location,
    overview: {
      headline: 'Sustainable Alternatives',
      summary: 'Alternatives.',
      totalCatalogEvaluated: catalog.length,
      matchedAlternativesCount: catalog.length,
      countsByCategory: {
        transportation: catalog.filter((i) => i.category === 'transportation').length,
        household_energy_heating: catalog.filter((i) => i.category === 'household_energy_heating')
          .length,
        everyday_activities: catalog.filter((i) => i.category === 'everyday_activities').length,
        consumption_waste: catalog.filter((i) => i.category === 'consumption_waste').length,
      },
      countsByImpact: {
        local_emissions: catalog.filter((i) => i.impactClassification === 'local_emissions').length,
        personal_exposure: catalog.filter((i) => i.impactClassification === 'personal_exposure')
          .length,
        both_exposure_and_emissions: catalog.filter(
          (i) => i.impactClassification === 'both_exposure_and_emissions',
        ).length,
        broader_sustainability: catalog.filter(
          (i) => i.impactClassification === 'broader_sustainability',
        ).length,
      },
      householdSummary: {
        householdSize: profile.householdSize,
        householdComposition: profile.householdComposition,
        primaryCommuteMode: profile.primaryCommuteMode,
        heatingType: profile.heatingType,
        ventilationContext: profile.ventilationContext,
        primaryZoneType: profile.locationPreferences.primaryZoneType,
      },
      outdoorConditionSummary: aqState.aqContextSummary,
      impactDistinctionLegend: [],
      activeTransportAqiNote: 'AQI-aware transport note.',
    },
    appliedFilters: {
      category: null,
      affordability: null,
      relevance: null,
      impactType: null,
      practicality: null,
    },
    airQualityContext: {
      usAqi: aq.aqi.usAqi,
      europeanAqi: aq.aqi.europeanAqi,
      dominantPollutant: aq.aqi.dominantPollutant,
      transparency: aq.transparency,
    },
    alternatives: catalog,
    featuredComparison: null,
    provenanceAndDisclosures: {
      dataSources: ['Profile', 'Open-Meteo'],
      methodologicalPrinciples: ['Qualitative only.'],
      limitationsSummary: 'No invented claims.',
    },
  };

  return { routines, indoor, alternatives };
}

describe('Phase 7 Cross-Module Consistency & Advisory Guardrail Integration (Unit)', () => {
  it('enforces poor AQI active-cycling blocks consistently across Routines, Alternatives, and GenAI validation', () => {
    const profile = createHouseholdProfile({ primaryCommuteMode: 'cycling' });
    const highAq = createAqSnapshot('high');
    const composed = composeDeterministicResponses(profile, highAq);
    const context = buildMinimizedAdvisoryContext({ profile, ...composed });

    const commuteBlocked = composed.routines.commuteSummary.options.find(
      (o) => o.id === 'commute-active-travel-unavailable',
    );
    expect(commuteBlocked?.status).toBe('unavailable');

    const altActive = composed.alternatives.alternatives.find(
      (a) => a.id === 'transport-active-travel-aqi-aware',
    );
    expect(altActive?.suitabilityStatus).toBe('not_advised_now');
    expect(context.airQuality.isCyclingNotAdvised).toBe(true);

    const rejectedBriefing = validateGeminiBriefingOutput({
      rawText: JSON.stringify({
        headline: 'Daily brief',
        summary: 'Great time to cycle to errands in Krakow today.',
        outdoorInfluenceSummary: 'US AQI 182.',
        indoorContextSummary: 'No indoor sensors connected.',
        priorityActions: [
          {
            recommendationId: 'transport-active-travel-aqi-aware',
            sourceModule: 'alternatives',
            title: 'Cycle today',
            rationale: 'Recommended time for cycling across Krakow.',
            impactCategory: 'personal_exposure',
          },
        ],
        cautionsAndLimitations: 'Educational only.',
        evidenceRefIds: ['EV-OPEN-METEO'],
      }),
      context,
    });
    expect(rejectedBriefing.ok).toBe(false);
  });

  it('discloses insufficient outdoor telemetry in Indoor ventilation and rejects unsafe airing claims in GenAI when telemetry is unavailable', () => {
    const profile = createHouseholdProfile();
    const unavailableAq = createAqSnapshot('unavailable');
    const composed = composeDeterministicResponses(profile, unavailableAq);
    const context = buildMinimizedAdvisoryContext({ profile, ...composed });

    expect(composed.indoor.ventilationGuidance.state).toBe('insufficient_data');
    expect(composed.routines.betterTimeWindows.status).toBe('unavailable');

    const validAction = context.recommendations[0];
    if (!validAction) {
      throw new Error('Expected at least one catalog recommendation');
    }

    const unsafeAiring = validateGeminiBriefingOutput({
      rawText: JSON.stringify({
        headline: 'Air out rooms',
        summary: 'Outdoor air is clean and good right now; great time to open windows.',
        outdoorInfluenceSummary: 'Outdoor telemetry unavailable.',
        indoorContextSummary: 'No indoor sensors connected.',
        priorityActions: [
          {
            recommendationId: validAction.recommendationId,
            sourceModule: validAction.sourceModule,
            title: validAction.title,
            rationale: validAction.whyRecommended,
            impactCategory: validAction.impactCategory,
          },
        ],
        cautionsAndLimitations: 'Educational only.',
        evidenceRefIds: ['EV-OPEN-METEO'],
      }),
      context,
    });
    expect(unsafeAiring.ok).toBe(false);
    if (!unsafeAiring.ok) {
      expect(unsafeAiring.reason).toMatch(/unavailable/i);
    }
  });

  it('enforces missing indoor sensors and HEPA gas/CO limitations across Indoor and GenAI validation', () => {
    const profile = createHouseholdProfile({ hasIndoorAirPurifier: true });
    const highAq = createAqSnapshot('high');
    const composed = composeDeterministicResponses(profile, highAq);
    const context = buildMinimizedAdvisoryContext({ profile, ...composed });

    expect(composed.indoor.overview.sensorStatus.sensorConnected).toBe(false);
    expect(context.indoorSensorConnected).toBe(false);
    expect(composed.indoor.purifierGuidance.gasAndVocLimitation).toMatch(/carbon monoxide|gases/i);

    const validAction = context.recommendations[0];
    if (!validAction) {
      throw new Error('Expected at least one catalog recommendation');
    }

    const fakeSensorClaim = validateGeminiBriefingOutput({
      rawText: JSON.stringify({
        headline: 'Indoor status',
        summary: 'Your indoor air sensor detects rising soot indoors.',
        outdoorInfluenceSummary: 'US AQI 182.',
        indoorContextSummary: 'Your home monitor reads elevated particles.',
        priorityActions: [
          {
            recommendationId: validAction.recommendationId,
            sourceModule: validAction.sourceModule,
            title: validAction.title,
            rationale: validAction.whyRecommended,
            impactCategory: validAction.impactCategory,
          },
        ],
        cautionsAndLimitations: 'Educational only.',
        evidenceRefIds: ['EV-EPA-INDOOR'],
      }),
      context,
    });
    expect(fakeSensorClaim.ok).toBe(false);
    if (!fakeSensorClaim.ok) {
      expect(fakeSensorClaim.reason).toMatch(/sensor/i);
    }
  });

  it('preserves Phase 5 conditional infrastructure caveats in advisory context and blocks not_advised_now overrides', () => {
    const profile = createHouseholdProfile({ primaryCommuteMode: 'cycling' });
    const highAq = createAqSnapshot('high');
    const composed = composeDeterministicResponses(profile, highAq);
    const context = buildMinimizedAdvisoryContext({ profile, ...composed });

    const transitEntry = context.recommendations.find(
      (entry) => entry.recommendationId === 'transport-public-transit',
    );
    expect(transitEntry?.status).toBe('conditional');
    expect(transitEntry?.limitations).toMatch(/Conditional on verified transit lines/i);

    const activeTravelEntry = context.recommendations.find(
      (entry) =>
        entry.sourceModule === 'alternatives' &&
        entry.recommendationId === 'transport-active-travel-aqi-aware',
    );
    expect(activeTravelEntry?.status).toBe('not_advised_now');
    if (!activeTravelEntry) {
      throw new Error('Expected transport-active-travel-aqi-aware entry');
    }

    const overriddenExplanation = validateGeminiExplanationOutput({
      rawText: JSON.stringify({
        headline: 'Active travel is recommended now',
        contextualSummary: 'This step is safe and recommended right now.',
        whyThisAppliesToHousehold: 'Matches cycling profile.',
        impactExplanation: {
          action: 'Bike along the corridor.',
          reason: 'Zero tailpipe emissions.',
          expectedBenefit: 'Lower vehicle traffic.',
          impactCategory: activeTravelEntry.impactCategory,
          evidence: 'EEA urban mobility.',
          limitations: 'Side streets preferred.',
        },
        alternativeOrTradeoffNote: 'Watch crossings.',
        evidenceRefIds: activeTravelEntry.evidenceIds,
      }),
      context,
      recommendation: activeTravelEntry,
    });
    expect(overriddenExplanation.ok).toBe(false);
    if (!overriddenExplanation.ok) {
      expect(overriddenExplanation.reason).toMatch(/contradicted not_advised_now/i);
    }
  });
});
