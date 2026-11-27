import type {
  AirQualityCurrentResponse,
  DailyRoutineResponse,
  HouseholdLifestyleRecord,
  IndoorAirGuidanceResponse,
  PersonalizedBriefingResponse,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App.tsx';
import { ApiClientError, type WebApiClient } from '../../src/lib/apiClient.ts';
import type { AuthService, AuthUserSnapshot } from '../../src/lib/authService.ts';
import type { HouseholdStore } from '../../src/lib/householdStore.ts';

const VERIFIED_USER: AuthUserSnapshot = {
  uid: 'uid_shell_integration',
  email: 'elena@household.org',
  displayName: 'Elena Nowak',
  emailVerified: true,
};

function makeProfile(overrides?: Partial<HouseholdLifestyleRecord>): HouseholdLifestyleRecord {
  return {
    ownerUid: 'uid_shell_integration',
    country: 'Poland',
    city: 'Krakow',
    neighborhood: 'Krowodrza',
    postalPrefix: '30-01',
    locationPreferences: { primaryZoneType: 'valley_basin', alertsEnabled: true },
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
    ...overrides,
  };
}

function makeAqCurrent(city: string, neighborhood: string): AirQualityCurrentResponse {
  const isGdansk = city === 'Gdansk';
  return {
    location: {
      city,
      neighborhood,
      country: 'Poland',
      postalPrefix: isGdansk ? '80-2' : '30-01',
      resolvedLabel: `${city}, Poland`,
      latitude: isGdansk ? 54.352 : 50.061,
      longitude: isGdansk ? 18.646 : 19.937,
      timezone: 'Europe/Warsaw',
      resolutionSource: 'saved_profile_geocoded',
    },
    aqi: {
      usAqi: {
        scale: 'us_aqi',
        scaleLabel: 'US AQI (EPA)',
        authorityLabel: 'U.S. EPA',
        value: isGdansk ? 26 : 142,
        status: 'available',
        category: isGdansk ? 'Good' : 'Unhealthy for Sensitive Groups',
        pollutionLevel: isGdansk ? 'low' : 'moderate',
        pollutionLevelLabel: isGdansk ? 'Low pollution level' : 'Moderate–elevated pollution level',
        severityToken: isGdansk ? 'good' : 'elevated',
        meaning: 'Outdoor AQI summary.',
        precautionSummary: 'Outdoor precaution.',
        methodologyNote: 'EPA scale.',
      },
      europeanAqi: {
        scale: 'european_aqi',
        scaleLabel: 'European AQI (EEA)',
        authorityLabel: 'EEA',
        value: isGdansk ? 14 : 74,
        status: 'available',
        category: isGdansk ? 'Good' : 'Poor',
        pollutionLevel: isGdansk ? 'low' : 'high',
        pollutionLevelLabel: isGdansk ? 'Low pollution level' : 'High pollution level',
        severityToken: isGdansk ? 'good' : 'high',
        meaning: 'EEA meaning.',
        precautionSummary: 'EEA precaution.',
        methodologyNote: 'EEA scale.',
      },
      dominantPollutant: {
        status: 'available',
        code: 'pm2_5',
        abbreviation: 'PM2.5',
        fullName: 'Fine Particulate Matter',
        basis: 'provider_sub_index',
        estimatedSubIndex: isGdansk ? 26 : 142,
        explanation: 'PM2.5 dominates.',
      },
    },
    pollutants: [
      {
        code: 'pm2_5',
        fullName: 'Fine Particulate Matter',
        abbreviation: 'PM2.5',
        concentration: isGdansk ? 7.4 : 52.0,
        unit: 'µg/m³',
        status: 'available',
        concentrationBand: isGdansk ? 'low' : 'high',
        concentrationBandLabel: isGdansk ? 'Low' : 'High',
        explanation: 'Fine particles.',
        distinctionNote: 'Mass concentration.',
      },
    ],
    forecastPreview: [
      {
        timestamp: '2026-11-23T09:00:00Z',
        usAqi: isGdansk ? 26 : 142,
        europeanAqi: isGdansk ? 14 : 74,
        pm25: isGdansk ? 7.4 : 52.0,
        pm10: 22,
        no2: 18,
        so2: 5,
        co: 280,
        o3: 36,
        availability: 'available',
      },
    ],
    guidance: {
      status: 'measured_evidence',
      headline: `Guidance for ${city}`,
      summary: 'Evidence-based summary.',
      fogDistinctionNote: 'Fog is water vapor.',
      guidanceScopeNote: 'Educational only.',
      actions: [],
    },
    transparency: {
      providerId: 'open-meteo',
      providerName: 'Open-Meteo Air Quality',
      dataNature: 'model_forecast',
      dataNatureDisclosure: 'Atmospheric forecast model output.',
      attribution: 'Open-Meteo CC BY 4.0',
      freshnessStatus: 'fresh',
      availabilityStatus: 'available',
      observationTimestamp: '2026-11-23T09:00:00Z',
      fetchedAt: '2026-11-23T09:02:00Z',
      cacheAgeSeconds: 0,
      fallbackActive: false,
      fallbackReason: null,
      methodologySummary: 'Separate EPA & EEA scales.',
    },
  };
}

function createFullHarnessMocks() {
  let profile = makeProfile();

  const authService: AuthService = {
    subscribeAuthState(cb) {
      cb(VERIFIED_USER);
      return () => {};
    },
    register: vi.fn(async () => VERIFIED_USER),
    login: vi.fn(async () => VERIFIED_USER),
    logout: vi.fn(async () => {}),
    resendVerificationEmail: vi.fn(async () => {}),
    refreshCurrentUser: vi.fn(async () => VERIFIED_USER),
    getFreshIdToken: vi.fn(async () => 'valid-firebase-token'),
    sendPasswordReset: vi.fn(async () => {}),
    verifyResetCode: vi.fn(async () => {}),
    confirmReset: vi.fn(async () => {}),
    applyEmailVerificationCode: vi.fn(async () => {}),
  };

  const householdStore: HouseholdStore = {
    syncVerifiedUserAccount: vi.fn(async () => {}),
    getHouseholdProfile: vi.fn(async () => profile),
    saveHouseholdProfile: vi.fn(async (uid, input) => {
      profile = { ownerUid: uid, ...input };
      return profile;
    }),
  };

  const apiClient: WebApiClient = {
    getHealth: vi.fn(async () => ({
      status: 'ok' as const,
      service: 'urban-air-quality-api' as const,
      version: '0.1.0',
      environment: 'test',
      uptimeSeconds: 100,
    })),
    getAuthSession: vi.fn(async () => ({
      authenticated: true as const,
      principal: {
        uid: VERIFIED_USER.uid,
        email: VERIFIED_USER.email,
        emailVerified: true,
        role: 'regular_user' as const,
        authTimeSeconds: 1700000000,
      },
    })),
    verifyToken: vi.fn(async () => ({
      verified: true as const,
      principal: {
        uid: VERIFIED_USER.uid,
        email: VERIFIED_USER.email,
        emailVerified: true,
        role: 'regular_user' as const,
        authTimeSeconds: 1700000000,
      },
    })),
    requestPasswordResetAudit: vi.fn(async () => ({
      accepted: true,
      message: 'Accepted.',
    })),
    getHouseholdProfile: vi.fn(async () => ({ profile })),
    saveHouseholdProfile: vi.fn(async (input) => {
      profile = { ownerUid: VERIFIED_USER.uid, ...input };
      return { profile };
    }),
    validateHouseholdProfile: vi.fn(async () => ({
      valid: true as const,
      ownerUid: VERIFIED_USER.uid,
    })),
    updateAirQualityLocation: vi.fn(async (input) => ({
      location: makeAqCurrent(input.city, input.neighborhood).location,
      updatedAt: '2026-11-23T09:10:00Z',
    })),
    getAirQualityCurrent: vi.fn(async () => makeAqCurrent(profile.city, profile.neighborhood)),
    getAirQualityForecast: vi.fn(async (query) => {
      const aq = makeAqCurrent(profile.city, profile.neighborhood);
      const hours = query?.hours === 48 ? 48 : 24;
      return {
        location: aq.location,
        horizonHours: hours,
        dataNature: 'model_forecast' as const,
        units: { usAqi: 'US AQI', europeanAqi: 'EAQI', pollutants: 'µg/m³' },
        hourly: aq.forecastPreview,
        transparency: aq.transparency,
      };
    }),
    getAirQualityPollutants: vi.fn(async () => {
      const aq = makeAqCurrent(profile.city, profile.neighborhood);
      return {
        location: aq.location,
        pollutants: aq.pollutants,
        dominantPollutant: aq.aqi.dominantPollutant,
        transparency: aq.transparency,
      };
    }),
    getAirQualityGuidance: vi.fn(async () => {
      const aq = makeAqCurrent(profile.city, profile.neighborhood);
      return {
        location: aq.location,
        guidance: aq.guidance,
        transparency: aq.transparency,
      };
    }),
    getAirQualityHealth: vi.fn(async () => ({
      status: 'ok' as const,
      provider: 'open-meteo' as const,
      providerReachable: true,
      airQualityCacheEntries: 1,
      geocodingCacheEntries: 1,
      cacheTtlSeconds: 600,
      staleTtlSeconds: 3600,
      checkedAt: '2026-11-23T09:00:00Z',
    })),
    getDailyRoutines: vi.fn(async (): Promise<DailyRoutineResponse> => {
      const aq = makeAqCurrent(profile.city, profile.neighborhood);
      const usVal = aq.aqi.usAqi.value ?? 50;
      const euVal = aq.aqi.europeanAqi.value ?? 30;
      return {
        routineId: `r-${profile.city}`,
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
        airQualityContext: { ...aq.aqi, pollutants: aq.pollutants, transparency: aq.transparency },
        overview: {
          headline: `Daily routines for ${profile.city}`,
          summary: 'Synchronized routine plan.',
          totalRecommended: 1,
          totalOptional: 0,
          totalUnavailable: 0,
          exposureCount: 1,
          emissionCount: 0,
          bothCount: 0,
          safetyAndScopeNotice: 'Educational guidance.',
        },
        betterTimeWindows: {
          status: 'available',
          windows: [
            {
              id: `win-${profile.city}-midday`,
              period: 'midday',
              startTimestamp: '2026-11-23T13:00:00Z',
              endTimestamp: '2026-11-23T15:00:00Z',
              label: '13:00–15:00',
              usAqiMin: usVal,
              usAqiMax: usVal,
              europeanAqiMin: euVal,
              europeanAqiMax: euVal,
              dataBasis: 'model_forecast',
              rationale: 'Lower daytime mixing window.',
              cautionNote: 'Model forecast timing; check conditions before departure.',
            },
          ],
          limitationDisclosure: 'Forecast model timing only.',
        },
        commuteSummary: {
          savedMode: profile.primaryCommuteMode,
          effectiveMode: profile.primaryCommuteMode,
          headline: 'Commute alignment',
          exposureVsEmissionsNote: 'Exposure and emissions separated.',
          options: [],
        },
        periods: [
          {
            period: 'morning',
            label: 'Morning window',
            windowHint: '07:00–09:00',
            periodSummary: 'Lower-exhaust morning school commute options.',
            items: [
              {
                id: 'routine-morning-school',
                period: 'morning',
                category: 'commute',
                title: `Transit school run in ${profile.city}`,
                status: 'recommended',
                statusReason: 'Public transit avoids personal vehicle cold-start emissions.',
                priorityScore: 92,
                suggestedWindow: '07:30–08:15',
                impactType: 'exposure_reduction',
                impactLabel: 'Personal exposure reduction',
                explanation: {
                  whatToDo: 'Take covered rail stops away from main traffic lanes.',
                  whyRecommended: 'Lowers sidewalk exhaust inhalation.',
                  influencingData: [
                    `US AQI ${usVal} in ${profile.city}`,
                    'Saved public transit school-run commute',
                  ],
                  expectedBenefit: 'Cuts direct curbside particulate inhalation.',
                  limitationsAndTradeoffs: 'Requires extra departure lead time.',
                },
                airQualityContext: `Current ${profile.city} conditions (US AQI ${usVal}).`,
                practicalAlternative: 'Use sheltered platform waiting areas.',
                freshnessAndUncertainty: 'Atmospheric forecast output (Open-Meteo CC BY 4.0).',
                informationBasis: 'rule_derived',
              },
            ],
          },
        ],
      };
    }),
    refreshDailyRoutines: vi.fn(async () => {
      throw new Error('Unexpected refreshDailyRoutines call');
    }),
    getIndoorAirGuidance: vi.fn(async (): Promise<IndoorAirGuidanceResponse> => {
      const aq = makeAqCurrent(profile.city, profile.neighborhood);
      return {
        guidanceId: `i-${profile.city}`,
        generatedAt: '2026-11-23T09:02:00Z',
        cachedResult: false,
        location: aq.location,
        overview: {
          headline: `Indoor guidance for ${profile.city}`,
          summary: 'Indoor overview.',
          householdSize: profile.householdSize,
          householdComposition: profile.householdComposition,
          ventilationContext: profile.ventilationContext,
          hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
          heatingType: profile.heatingType,
          primaryZoneType: profile.locationPreferences.primaryZoneType,
          outdoorConditionSummary: `${profile.city} conditions.`,
          sensorStatus: {
            sensorConnected: false,
            disclosureStatement: 'No indoor sensors connected.',
            evidenceDistinctions: [],
          },
        },
        airQualityContext: { ...aq.aqi, pollutants: aq.pollutants, transparency: aq.transparency },
        scenarioContext: {
          selectedScenario: 'baseline',
          isSimulation: false,
          simulationLabel: 'Baseline',
          scenarioTitle: 'Baseline',
          scenarioDescription: 'Saved home setup.',
          scenarioFocusNotes: [],
          availableScenarios: [],
        },
        ventilationGuidance: {
          state: 'shorter_timed_ventilation',
          stateLabel: 'Targeted ventilation',
          headline: 'Ventilate briefly outside traffic peaks',
          summary: 'Ventilation guidance.',
          bestWindowHint: null,
          windowDisclosure: 'Model disclosure.',
          essentialSafetyReminder: 'Never block safety vents.',
          constraintsAndTradeoffs: ['No indoor measurements.'],
          informationCategory: 'estimated_inferred_indoor',
        },
        purifierGuidance: {
          hasPurifier: profile.hasIndoorAirPurifier,
          scenarioSimulatedPurifier: false,
          headline: 'Purifier support',
          summary: 'HEPA filtration note.',
          practicalGuidance: ['Run during cooking.'],
          gasAndVocLimitation: 'HEPA captures particles, not carbon monoxide.',
          nonPurchaseNote: 'Use existing setup.',
          informationCategory: 'general_educational_guidance',
        },
        actionPlan: [],
        pollutionSources: [],
        provenanceAndSafety: {
          dataSources: ['Profile'],
          nonMedicalNotice: 'Educational guidance only.',
          limitationsSummary: 'No indoor sensors.',
        },
      };
    }),
    getSustainableAlternatives: vi.fn(async (): Promise<SustainableAlternativesResponse> => {
      const aq = makeAqCurrent(profile.city, profile.neighborhood);
      return {
        advisoryId: `a-${profile.city}`,
        generatedAt: '2026-11-23T09:02:00Z',
        cachedResult: false,
        location: aq.location,
        overview: {
          headline: `Sustainable alternatives for ${profile.city}`,
          summary: 'Practical choices.',
          totalCatalogEvaluated: 0,
          matchedAlternativesCount: 0,
          countsByCategory: {
            transportation: 0,
            household_energy_heating: 0,
            everyday_activities: 0,
            consumption_waste: 0,
          },
          countsByImpact: {
            local_emissions: 0,
            personal_exposure: 0,
            both_exposure_and_emissions: 0,
            broader_sustainability: 0,
          },
          householdSummary: {
            householdSize: profile.householdSize,
            householdComposition: profile.householdComposition,
            primaryCommuteMode: profile.primaryCommuteMode,
            heatingType: profile.heatingType,
            ventilationContext: profile.ventilationContext,
            primaryZoneType: profile.locationPreferences.primaryZoneType,
          },
          outdoorConditionSummary: `${profile.city} AQI.`,
          impactDistinctionLegend: [],
          activeTransportAqiNote: 'AQI-aware transport.',
        },
        appliedFilters: {
          category: null,
          affordability: null,
          relevance: null,
          impactType: null,
          practicality: null,
        },
        airQualityContext: { ...aq.aqi, transparency: aq.transparency },
        alternatives: [],
        featuredComparison: null,
        provenanceAndDisclosures: {
          dataSources: ['Profile'],
          methodologicalPrinciples: ['Qualitative only.'],
          limitationsSummary: 'No invented metrics.',
        },
      };
    }),
    getPersonalizedBriefing: vi.fn(async (): Promise<PersonalizedBriefingResponse> => {
      const aq = makeAqCurrent(profile.city, profile.neighborhood);
      return {
        briefingId: `b-${profile.city}`,
        location: aq.location,
        householdSummary: {
          city: profile.city,
          neighborhood: profile.neighborhood,
          primaryZoneType: profile.locationPreferences.primaryZoneType,
          householdSize: profile.householdSize,
          householdComposition: profile.householdComposition,
          primaryCommuteMode: profile.primaryCommuteMode,
          outdoorActivityPattern: profile.outdoorActivityPattern,
          ventilationContext: profile.ventilationContext,
          hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
          heatingType: profile.heatingType,
          preferredGuidanceFocus: profile.lifestylePreferences.preferredGuidanceFocus,
        },
        airQualitySnapshot: {
          freshnessStatus: 'fresh',
          availabilityStatus: 'available',
          observationTimestamp: '2026-11-23T09:00:00Z',
          usAqiValue: aq.aqi.usAqi.value,
          usAqiCategory: aq.aqi.usAqi.category,
          europeanAqiValue: aq.aqi.europeanAqi.value,
          europeanAqiCategory: aq.aqi.europeanAqi.category,
          dominantPollutantCode: 'pm2_5',
          dominantPollutantLabel: 'PM2.5',
          isHighOrWorse: false,
          isElevatedOrWorse: profile.city === 'Krakow',
          isCyclingNotAdvised: false,
          bestForecastWindowLabel: null,
          aqSummary: `${profile.city} conditions.`,
          activeScaleNote: 'dual_epa_eea',
        },
        headline: `Personalized briefing for ${profile.city}`,
        summary: `Tailored briefing in ${profile.city}.`,
        outdoorInfluenceSummary: `${profile.city} outdoor air.`,
        indoorContextSummary: 'No indoor sensors connected.',
        priorityActions: [
          {
            recommendationId: 'rec-1',
            sourceModule: 'routines',
            title: 'Shift outdoor errands to midday mixing hours',
            rationale: 'Lower PM2.5 expected around 13:00.',
            impactCategory: 'personal_exposure',
            impactCategoryLabel: 'Personal exposure reduction',
            deterministicStatus: 'recommended',
          },
          {
            recommendationId: 'rec-2',
            sourceModule: 'indoor',
            title: 'Run HEPA purifier during evening cooking',
            rationale: 'Captures indoor cooking particulates.',
            impactCategory: 'personal_exposure',
            impactCategoryLabel: 'Personal exposure reduction',
            deterministicStatus: 'recommended_now',
          },
          {
            recommendationId: 'rec-3',
            sourceModule: 'alternatives',
            title: 'Bundle vehicle errands into one warm-engine loop',
            rationale: 'Cuts cold-start tailpipe exhaust.',
            impactCategory: 'local_emissions',
            impactCategoryLabel: 'Local emissions reduction',
            deterministicStatus: 'recommended',
          },
          {
            recommendationId: 'rec-4-hidden-on-overview',
            sourceModule: 'alternatives',
            title: 'Fourth lower-priority item',
            rationale: 'Should not render on concise Overview card list.',
            impactCategory: 'broader_sustainability',
            impactCategoryLabel: 'Broader sustainability',
            deterministicStatus: 'optional',
          },
        ],
        cautionsAndLimitations: 'Educational only.',
        verifiedEvidence: [
          {
            id: 'EV-OPEN-METEO',
            sourceName: 'Open-Meteo Air Quality',
            sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
            scope: 'Outdoor model forecast',
            relevantFinding: 'Model forecast snapshot.',
            limitations: 'Not direct ground sensor.',
          },
        ],
        availableRecommendations: [],
        generationMeta: {
          generationMode: 'gemini',
          model: 'gemini-4-hydrogen',
          fallbackReason: null,
          aiDisclosure: 'Synthesized by Gemini from verified VAYORA data.',
          nonMedicalNotice: 'Educational guidance only.',
          freshnessDisclosure: 'fresh',
          freshnessMessage: 'Fresh telemetry.',
          contextFingerprint: `fp-${profile.city}`,
          cachedResult: false,
          generatedAt: '2026-11-23T09:02:00Z',
          latencyMs: 90,
          focus: 'balanced',
        },
      };
    }),
    refreshIndoorAirGuidance: vi.fn(),
    compareSustainableAlternative: vi.fn(),
    refreshSustainableAlternatives: vi.fn(),
    explainRecommendation: vi.fn(),
    compareChoicesExplanation: vi.fn(),
    refreshPersonalizedAdvisory: vi.fn(),
    getAdvisoryMetrics: vi.fn(),
  };

  return { authService, householdStore, apiClient };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('Phase 2 Multi-Page Workspace Navigation, Caching, Preferences & Accessibility (Unit)', () => {
  it('opens on Overview with only 3 initial module fetches, navigates across all 7 destinations, caches shared responses, propagates location changes, and passes WCAG 2.2 AA', async () => {
    const { authService, householdStore, apiClient } = createFullHarnessMocks();

    const { container } = render(
      <App authService={authService} householdStore={householdStore} apiClient={apiClient} />,
    );

    // Default authenticated landing page is Overview
    const overviewPage = await screen.findByTestId('page-overview');
    expect(overviewPage).toBeInTheDocument();
    expect(window.location.pathname).toBe('/overview');
    expect(document.title).toContain('Overview');
    expect(
      screen.getByRole('heading', { level: 1, name: /Air Quality Overview/i }),
    ).toBeInTheDocument();

    // Concise Overview shows top 3 recommended actions (not the 4th) & next routine
    expect(
      await within(overviewPage).findByText('Shift outdoor errands to midday mixing hours'),
    ).toBeInTheDocument();
    expect(
      within(overviewPage).getByText('Run HEPA purifier during evening cooking'),
    ).toBeInTheDocument();
    expect(
      within(overviewPage).getByText('Bundle vehicle errands into one warm-engine loop'),
    ).toBeInTheDocument();
    expect(within(overviewPage).queryByText('Fourth lower-priority item')).not.toBeInTheDocument();
    expect(await within(overviewPage).findByTestId('overview-next-routine')).toHaveTextContent(
      /Transit school run in Krakow/i,
    );

    // Phase 2 performance invariant: Indoor Air and Sustainable Alternatives NOT fetched on Overview load
    expect(apiClient.getAirQualityCurrent).toHaveBeenCalledTimes(1);
    expect(apiClient.getPersonalizedBriefing).toHaveBeenCalledTimes(1);
    expect(apiClient.getDailyRoutines).toHaveBeenCalledTimes(1);
    expect(apiClient.getIndoorAirGuidance).toHaveBeenCalledTimes(0);
    expect(apiClient.getSustainableAlternatives).toHaveBeenCalledTimes(0);

    // Sidebar renders all 7 canonical destinations
    const sidebarNav = screen.getByRole('navigation', { name: 'Primary navigation' });
    const navLinks = Array.from(sidebarNav.querySelectorAll('a'));
    expect(navLinks.map((a) => a.textContent)).toEqual([
      'Overview',
      'Air Quality',
      'Daily Routines',
      'Indoor Air',
      'Sustainable Alternatives',
      'My Household',
      'Settings',
    ]);
    expect(screen.getByTestId('sidebar-nav-overview')).toHaveAttribute('aria-current', 'page');

    // Navigate to Daily Routines -> hits cached response (no redundant network fetch)
    fireEvent.click(screen.getByTestId('sidebar-nav-daily-routines'));
    expect(await screen.findByTestId('page-daily-routines')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/daily-routines');
    expect(document.title).toContain('Daily Routines');
    expect(apiClient.getDailyRoutines).toHaveBeenCalledTimes(1);

    // Navigate to Indoor Air -> lazy loads & fetches once
    fireEvent.click(screen.getByTestId('sidebar-nav-indoor-air'));
    expect(await screen.findByTestId('page-indoor-air')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/indoor-air');
    expect(apiClient.getIndoorAirGuidance).toHaveBeenCalledTimes(1);

    // Navigate to Sustainable Alternatives -> lazy loads & fetches once
    fireEvent.click(screen.getByTestId('sidebar-nav-sustainable-alternatives'));
    expect(await screen.findByTestId('page-sustainable-alternatives')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/sustainable-alternatives');
    expect(apiClient.getSustainableAlternatives).toHaveBeenCalledTimes(1);

    // Navigate to My Household -> verifies owner isolation disclosure & single edit action
    fireEvent.click(screen.getByTestId('sidebar-nav-household'));
    const householdPage = await screen.findByTestId('page-household');
    expect(householdPage).toBeInTheDocument();
    expect(window.location.pathname).toBe('/household');
    expect(within(householdPage).getByText('uid_shell_integration')).toBeInTheDocument();
    expect(
      within(householdPage).getAllByRole('button', { name: /Edit preferences/i }),
    ).toHaveLength(1);

    // Navigate to Air Quality -> uses cached AQ telemetry, then updates location to Gdansk
    fireEvent.click(screen.getByTestId('sidebar-nav-air-quality'));
    expect(await screen.findByTestId('page-air-quality')).toBeInTheDocument();
    expect(await screen.findByTestId('air-quality-dashboard')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/air-quality');
    expect(apiClient.getAirQualityCurrent).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Change location' }));
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Gdansk' } });
    fireEvent.change(screen.getByLabelText(/Neighborhood or district/), {
      target: { value: 'Wrzeszcz' },
    });
    fireEvent.change(screen.getByLabelText(/Postal prefix/), { target: { value: '80-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save location' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Wrzeszcz, Gdansk, Poland/i }),
      ).toBeInTheDocument();
    });

    // Navigate to Settings -> update guidance focus & alert toggle + password reset
    fireEvent.click(screen.getByTestId('sidebar-nav-settings'));
    const settingsPage = await screen.findByTestId('page-settings');
    expect(settingsPage).toBeInTheDocument();
    expect(window.location.pathname).toBe('/settings');

    fireEvent.change(screen.getByLabelText('Preferred guidance focus'), {
      target: { value: 'balanced' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(
      await screen.findByText(/Guidance focus and smog alert settings have been saved/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send password reset email' }));
    expect(
      await screen.findByText(
        /Password reset instructions have been sent to elena@household\.org/i,
      ),
    ).toBeInTheDocument();
    expect(authService.sendPasswordReset).toHaveBeenCalledWith('elena@household.org');

    // Location update invalidated cache and propagates to Overview & Daily Routines
    fireEvent.click(screen.getByTestId('sidebar-nav-overview'));
    expect(await screen.findByText('Personalized briefing for Gdansk')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sidebar-nav-daily-routines'));
    expect(await screen.findByText('Daily routines for Gdansk')).toBeInTheDocument();

    const axeResults = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    });
    expect(axeResults.violations).toEqual([]);
  });

  it('supports desktop sidebar collapse with tooltips, mobile drawer Escape/close focus restoration, and browser popstate back/forward', async () => {
    const { authService, householdStore, apiClient } = createFullHarnessMocks();

    render(<App authService={authService} householdStore={householdStore} apiClient={apiClient} />);
    await screen.findByTestId('page-overview');

    // Desktop sidebar collapse toggle & collapsed tooltip verification
    const sidebar = screen.getByTestId('desktop-sidebar');
    const collapseBtn = screen.getByTestId('sidebar-collapse-toggle');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(collapseBtn);
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('sidebar-tooltip-air-quality')).toHaveTextContent('Air Quality');
    expect(window.localStorage.getItem('vayora.sidebar.collapsed')).toBe('true');

    // Mobile drawer open -> Escape dismissal -> focus restored to menu trigger
    const menuTrigger = screen.getByTestId('mobile-menu-trigger');
    fireEvent.click(menuTrigger);
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation menu' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId('mobile-menu-close')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Mobile navigation menu' }),
      ).not.toBeInTheDocument();
    });
    expect(menuTrigger).toHaveFocus();

    // Mobile drawer item selection closes drawer & navigates
    fireEvent.click(menuTrigger);
    fireEvent.click(screen.getByTestId('mobile-nav-household'));
    expect(await screen.findByTestId('page-household')).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Mobile navigation menu' }),
    ).not.toBeInTheDocument();

    // Browser Back/Forward simulation via popstate
    window.history.replaceState({ workspacePage: 'overview' }, '', '/overview');
    fireEvent(window, new PopStateEvent('popstate'));
    expect(await screen.findByTestId('page-overview')).toBeInTheDocument();

    window.history.replaceState({ workspacePage: 'settings' }, '', '/settings');
    fireEvent(window, new PopStateEvent('popstate'));
    expect(await screen.findByTestId('page-settings')).toBeInTheDocument();
  });

  it('blocks unauthenticated access to nested workspace URLs and restores intended destination after login', async () => {
    window.history.replaceState({}, '', '/indoor-air');
    const { householdStore, apiClient } = createFullHarnessMocks();
    const listenerRef: { current: ((u: AuthUserSnapshot | null) => void) | null } = {
      current: null,
    };

    const delayedAuthService: AuthService = {
      subscribeAuthState(cb) {
        listenerRef.current = cb;
        cb(null);
        return () => {};
      },
      register: vi.fn(async () => VERIFIED_USER),
      login: vi.fn(async () => VERIFIED_USER),
      logout: vi.fn(async () => {}),
      resendVerificationEmail: vi.fn(async () => {}),
      refreshCurrentUser: vi.fn(async () => VERIFIED_USER),
      getFreshIdToken: vi.fn(async () => 'valid-firebase-token'),
      sendPasswordReset: vi.fn(async () => {}),
      verifyResetCode: vi.fn(async () => {}),
      confirmReset: vi.fn(async () => {}),
      applyEmailVerificationCode: vi.fn(async () => {}),
    };

    render(
      <App
        authService={delayedAuthService}
        householdStore={householdStore}
        apiClient={apiClient}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /Sign in to Urban Air Quality Assistant/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /Sign in with a verified household account/i,
    );

    // After signing in, user lands directly on the intended /indoor-air route
    expect(listenerRef.current).not.toBeNull();
    listenerRef.current?.(VERIFIED_USER);
    expect(await screen.findByTestId('page-indoor-air')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/indoor-air');
  });

  it('renders OverviewPage upcoming routine 429 error state independently without blocking AQI or briefing cards', async () => {
    const { authService, householdStore, apiClient } = createFullHarnessMocks();
    (apiClient.getDailyRoutines as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiClientError({
        message: 'Rate limited',
        statusCode: 429,
        code: 'RATE_LIMITED',
        requestId: 'req-overview-429',
      }),
    );

    render(<App authService={authService} householdStore={householdStore} apiClient={apiClient} />);

    const overviewPage = await screen.findByTestId('page-overview');
    expect(
      await within(overviewPage).findByText(
        /Too many requests while updating Upcoming Daily Routine/i,
      ),
    ).toBeInTheDocument();
    expect(within(overviewPage).getByText('Upcoming routine unavailable')).toBeInTheDocument();
    expect(await within(overviewPage).findByTestId('overview-us-aqi-value')).toHaveTextContent(
      '142',
    );
    expect(
      await within(overviewPage).findByText('Personalized briefing for Krakow'),
    ).toBeInTheDocument();
  });

  it('formats 429 rate-limit errors consistently and logs out cleanly when any module receives 401 session expiration', async () => {
    const { authService, householdStore, apiClient } = createFullHarnessMocks();

    render(<App authService={authService} householdStore={householdStore} apiClient={apiClient} />);

    // Allow initial Overview loads to settle cleanly before testing dedicated Daily Routines interaction
    await screen.findByTestId('overview-next-routine');

    fireEvent.click(await screen.findByTestId('sidebar-nav-daily-routines'));
    await screen.findByTestId('daily-routines-workspace');

    (apiClient.refreshDailyRoutines as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiClientError({
        message: 'Rate limited',
        statusCode: 429,
        code: 'RATE_LIMITED',
        requestId: 'req-429',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Refresh routines' }));

    expect(
      await screen.findByText(/Too many requests while updating Low-Emission Daily Routines/i),
    ).toBeInTheDocument();

    // Trigger 401 on Air Quality telemetry refresh -> App recovers to login gate
    fireEvent.click(screen.getByTestId('sidebar-nav-air-quality'));
    await screen.findByTestId('air-quality-dashboard');

    (apiClient.getAirQualityCurrent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiClientError({
        message: 'Session revoked',
        statusCode: 401,
        code: 'UNAUTHORIZED',
        requestId: 'req-401',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh telemetry' }));
    expect(
      await screen.findByText(/Your session expired or was revoked\. Please sign in again\./i),
    ).toBeInTheDocument();
    expect(authService.logout).toHaveBeenCalled();
  });
});
