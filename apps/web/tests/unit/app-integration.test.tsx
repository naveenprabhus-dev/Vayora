import type {
  AirQualityCurrentResponse,
  DailyRoutineResponse,
  HouseholdLifestyleRecord,
  IndoorAirGuidanceResponse,
  PersonalizedBriefingResponse,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  const apiClient = {
    getAuthSession: vi.fn(async () => ({
      authenticated: true as const,
      principal: {
        uid: VERIFIED_USER.uid,
        email: VERIFIED_USER.email,
        emailVerified: true,
        role: 'member' as const,
        authTimeSeconds: 1700000000,
      },
    })),
    getHouseholdProfile: vi.fn(async () => ({ profile })),
    saveHouseholdProfile: vi.fn(async (input) => {
      profile = { ownerUid: VERIFIED_USER.uid, ...input };
      return { profile };
    }),
    updateAirQualityLocation: vi.fn(async (input) => ({
      location: makeAqCurrent(input.city, input.neighborhood).location,
      updatedAt: '2026-11-23T09:10:00Z',
    })),
    getAirQualityCurrent: vi.fn(async () => makeAqCurrent(profile.city, profile.neighborhood)),
    getAirQualityForecast: vi.fn(async ({ hours = 24 }) => ({
      location: makeAqCurrent(profile.city, profile.neighborhood).location,
      horizonHours: hours,
      dataNature: 'model_forecast' as const,
      units: { usAqi: 'US AQI', europeanAqi: 'EAQI', pollutants: 'µg/m³' },
      hourly: makeAqCurrent(profile.city, profile.neighborhood).forecastPreview,
      transparency: makeAqCurrent(profile.city, profile.neighborhood).transparency,
    })),
    getDailyRoutines: vi.fn(async (): Promise<DailyRoutineResponse> => {
      const aq = makeAqCurrent(profile.city, profile.neighborhood);
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
          windows: [],
          limitationDisclosure: 'Forecast model timing only.',
        },
        commuteSummary: {
          savedMode: profile.primaryCommuteMode,
          effectiveMode: profile.primaryCommuteMode,
          headline: 'Commute alignment',
          exposureVsEmissionsNote: 'Exposure and emissions separated.',
          options: [],
        },
        periods: [],
      };
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
        priorityActions: [],
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
  } as unknown as WebApiClient;

  return { authService, householdStore, apiClient };
}

afterEach(() => {
  cleanup();
});

describe('Phase 7 Full App Integration, Fetch Deduplication, Navigation & Error Handling (Unit)', () => {
  it('mounts all 5 workspaces with exactly 1 initial fetch per module, aligns nav order/focus, propagates location updates cleanly without double-fetching, and passes axe WCAG 2.2 AA', async () => {
    const { authService, householdStore, apiClient } = createFullHarnessMocks();

    const { container } = render(
      <App authService={authService} householdStore={householdStore} apiClient={apiClient} />,
    );

    expect(await screen.findByTestId('personalized-advisory-workspace')).toBeInTheDocument();
    expect(await screen.findByTestId('air-quality-dashboard')).toBeInTheDocument();
    expect(await screen.findByTestId('daily-routines-workspace')).toBeInTheDocument();
    expect(await screen.findByTestId('indoor-air-assistant-workspace')).toBeInTheDocument();
    expect(await screen.findByTestId('sustainable-alternatives-workspace')).toBeInTheDocument();

    // Critical Phase 7 invariant: zero duplicate fetches on mount!
    expect(apiClient.getPersonalizedBriefing).toHaveBeenCalledTimes(1);
    expect(apiClient.getAirQualityCurrent).toHaveBeenCalledTimes(1);
    expect(apiClient.getDailyRoutines).toHaveBeenCalledTimes(1);
    expect(apiClient.getIndoorAirGuidance).toHaveBeenCalledTimes(1);
    expect(apiClient.getSustainableAlternatives).toHaveBeenCalledTimes(1);

    // Navigation link order strictly matches DOM order & supports keyboard focus jump
    const sectionNav = screen.getByRole('navigation', { name: 'Workspace sections' });
    const navLinks = Array.from(sectionNav.querySelectorAll('a'));
    expect(navLinks.map((a) => a.textContent)).toEqual([
      'Personalized Briefing',
      'Air Quality Intelligence',
      'Low-Emission Daily Routines',
      'Indoor Air Quality Assistant',
      'Sustainable Alternatives',
    ]);

    const aqLink = navLinks[1];
    if (!aqLink) throw new Error('Expected Air Quality Intelligence nav link');
    fireEvent.click(aqLink);
    expect(aqLink).toHaveAttribute('aria-current', 'location');
    expect(document.getElementById('air-quality-location-heading')).toHaveFocus();

    // Inline location update in AirQualityDashboard propagates to ALL 5 workspaces with 1 call each (total = 2)
    fireEvent.click(screen.getByRole('button', { name: 'Change location' }));
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Gdansk' } });
    fireEvent.change(screen.getByLabelText(/Neighborhood or district/), {
      target: { value: 'Wrzeszcz' },
    });
    fireEvent.change(screen.getByLabelText(/Postal prefix/), { target: { value: '80-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save location' }));

    await waitFor(() => {
      expect(screen.getByText('Personalized briefing for Gdansk')).toBeInTheDocument();
      expect(screen.getByText('Daily routines for Gdansk')).toBeInTheDocument();
      expect(screen.getByText('Indoor guidance for Gdansk')).toBeInTheDocument();
      expect(screen.getByText('Sustainable alternatives for Gdansk')).toBeInTheDocument();
    });

    expect(apiClient.getAirQualityCurrent).toHaveBeenCalledTimes(2);
    expect(apiClient.getPersonalizedBriefing).toHaveBeenCalledTimes(2);
    expect(apiClient.getDailyRoutines).toHaveBeenCalledTimes(2);
    expect(apiClient.getIndoorAirGuidance).toHaveBeenCalledTimes(2);
    expect(apiClient.getSustainableAlternatives).toHaveBeenCalledTimes(2);

    const axeResults = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    });
    expect(axeResults.violations).toEqual([]);
  });

  it('formats 429 rate-limit errors consistently and logs out cleanly when any module receives 401 session expiration', async () => {
    const { authService, householdStore, apiClient } = createFullHarnessMocks();
    (apiClient.getDailyRoutines as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiClientError({
        message: 'Rate limited',
        statusCode: 429,
        code: 'RATE_LIMITED',
        requestId: 'req-429',
      }),
    );

    render(<App authService={authService} householdStore={householdStore} apiClient={apiClient} />);

    expect(
      await screen.findByText(/Too many requests while updating Low-Emission Daily Routines/i),
    ).toBeInTheDocument();

    // Trigger 401 on refresh telemetry -> App recovers to login gate
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
