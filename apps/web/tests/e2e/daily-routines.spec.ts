import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function buildApiEnvelope<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      requestId: 'e2e-routines-req-1',
      timestamp: '2026-11-22T12:00:00.000Z',
    },
  };
}

const MOCK_ROUTINE_PAYLOAD = {
  routineId: 'uid_e2e_family::routines_test_hash',
  generatedAt: '2026-11-22T12:00:00Z',
  cachedResult: false,
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
  profileContext: {
    primaryZoneType: 'valley_basin',
    householdSize: 4,
    householdComposition: ['adults', 'young_children'],
    savedCommuteMode: 'gas_vehicle',
    effectiveCommuteMode: 'gas_vehicle',
    savedOutdoorPattern: 'school_run_family',
    effectiveOutdoorPattern: 'school_run_family',
    heatingType: 'district',
    ventilationContext: 'natural_windows',
    hasIndoorAirPurifier: true,
    preferredGuidanceFocus: 'balanced',
    isScenarioPreview: false,
  },
  airQualityContext: {
    usAqi: {
      scale: 'us_aqi',
      scaleLabel: 'US AQI (EPA)',
      authorityLabel: 'U.S. EPA 0–500 Scale',
      value: 112,
      status: 'available',
      category: 'Unhealthy for Sensitive Groups',
      pollutionLevel: 'moderate',
      pollutionLevelLabel: 'Moderate–elevated pollution level',
      severityToken: 'elevated',
      meaning: 'Elevated winter PM2.5 accumulation.',
      precautionSummary: 'Keep outdoor exertion moderate and filter indoor air.',
      methodologyNote: 'US EPA breakpoints.',
    },
    europeanAqi: {
      scale: 'european_aqi',
      scaleLabel: 'European AQI (EEA)',
      authorityLabel: 'EEA 0–100+ Index',
      value: 64,
      status: 'available',
      category: 'Poor',
      pollutionLevel: 'high',
      pollutionLevelLabel: 'High pollution level',
      severityToken: 'high',
      meaning: 'Poor air quality index.',
      precautionSummary: 'Prefer low-traffic routes.',
      methodologyNote: 'EEA bands.',
    },
    dominantPollutant: {
      status: 'available',
      code: 'pm2_5',
      abbreviation: 'PM2.5',
      fullName: 'Fine Particulate Matter',
      basis: 'provider_sub_index',
      estimatedSubIndex: 112,
      explanation: 'PM2.5 drives health index.',
    },
    pollutants: [
      {
        code: 'pm2_5',
        fullName: 'Fine Particulate Matter',
        abbreviation: 'PM2.5',
        concentration: 39.8,
        unit: 'µg/m³',
        status: 'available',
        concentrationBand: 'elevated',
        concentrationBandLabel: 'Elevated concentration',
        explanation: 'Fine particles.',
        distinctionNote: 'µg/m³ concentration.',
      },
    ],
    transparency: {
      providerId: 'open-meteo',
      providerName: 'Open-Meteo',
      dataNature: 'model_forecast',
      dataNatureDisclosure: 'Model forecast.',
      attribution: 'Open-Meteo CC BY 4.0',
      freshnessStatus: 'fresh',
      availabilityStatus: 'available',
      observationTimestamp: '2026-11-22T12:00:00Z',
      fetchedAt: '2026-11-22T12:01:00Z',
      cacheAgeSeconds: 10,
      fallbackActive: false,
      fallbackReason: null,
      methodologySummary: 'Independent scales.',
    },
  },
  overview: {
    headline: 'Low-Emission Daily Routines (Krakow)',
    summary: 'Tailored exposure precautions and low-emission actions for your household.',
    totalRecommended: 4,
    totalOptional: 2,
    totalUnavailable: 0,
    exposureCount: 3,
    emissionCount: 2,
    bothCount: 1,
    safetyAndScopeNotice: 'Evidence-based guidance only. Zero medical diagnoses.',
  },
  betterTimeWindows: {
    status: 'available',
    windows: [
      {
        id: 'win-midday',
        period: 'midday',
        startTimestamp: '2026-11-22T11:00:00Z',
        endTimestamp: '2026-11-22T14:00:00Z',
        label: 'Midday dispersion window (11:00 – 14:00)',
        usAqiMin: 72,
        usAqiMax: 85,
        europeanAqiMin: 45,
        europeanAqiMax: 52,
        dataBasis: 'model_forecast',
        rationale: 'Thermal lift lowers surface accumulation.',
        cautionNote: 'Weather dependent.',
      },
    ],
    limitationDisclosure: 'Model derived forecast windows.',
  },
  commuteSummary: {
    savedMode: 'gas_vehicle',
    effectiveMode: 'gas_vehicle',
    headline: 'Commute & Travel Strategy (Gas vehicle)',
    exposureVsEmissionsNote:
      'Shifting to public transit reduces both local emissions and inhalation exposure.',
    options: [
      {
        id: 'commute-option-1',
        modeLabel: 'Public Transit / Carpool',
        status: 'recommended',
        statusReason: 'Lowers city emissions.',
        impactType: 'both',
        impactLabel: 'Exposure & emissions',
        summary: 'Take public transit.',
        reason: 'Reduces tailpipe output.',
        infrastructureNote: 'Assumes established transit schedules.',
      },
    ],
  },
  periods: [
    {
      period: 'morning',
      label: 'Morning',
      windowHint: '06:00 – 10:00',
      periodSummary: 'Morning peak traffic inversion management.',
      items: [
        {
          id: 'morning-school-family-routine',
          period: 'morning',
          category: 'outdoor_activity',
          title: 'Timing the morning school walking route',
          status: 'recommended',
          statusReason: 'Avoid peak roadside vehicle idling.',
          priorityScore: 90,
          suggestedWindow: '08:00 – 08:30',
          impactType: 'exposure_reduction',
          impactLabel: 'Personal exposure',
          explanation: {
            whatToDo: 'Walk along side streets away from arterial bus routes.',
            whyRecommended: 'Roadside particulate concentration peaks during cold morning hours.',
            influencingData: ['US AQI 112', 'PM2.5 39.8 µg/m³'],
            expectedBenefit: 'Lowers direct inhalation during sensitive morning hours.',
            limitationsAndTradeoffs: 'Walk duration may increase slightly.',
          },
          airQualityContext: 'US AQI 112 with elevated PM2.5.',
          practicalAlternative: 'Drive with cabin recirculation.',
          freshnessAndUncertainty: 'Fresh model forecast.',
          informationBasis: 'measured_evidence',
        },
      ],
    },
  ],
};

async function setupRoutinesE2ERoutes(page: Page) {
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          authenticated: true,
          principal: {
            uid: 'uid_e2e_family',
            email: 'elena@household.org',
            emailVerified: true,
            role: 'regular_user',
            authTimeSeconds: 1700000000,
          },
        }),
      ),
    });
  });

  await page.route('**/api/v1/household/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          profile: {
            ownerUid: 'uid_e2e_family',
            country: 'Poland',
            city: 'Krakow',
            neighborhood: 'Krowodrza',
            postalPrefix: '30-01',
            locationPreferences: { primaryZoneType: 'valley_basin', alertsEnabled: true },
            householdSize: 4,
            householdComposition: ['adults', 'young_children'],
            primaryCommuteMode: 'gas_vehicle',
            outdoorActivityPattern: 'school_run_family',
            ventilationContext: 'filtered_hvac_merv13',
            hasIndoorAirPurifier: true,
            heatingType: 'district',
            lifestylePreferences: {
              preferredGuidanceFocus: 'balanced',
              reminderCadence: 'daily_smog_alerts',
            },
            onboardingCompleted: true,
          },
        }),
      ),
    });
  });

  await page.route('**/api/v1/routines/daily*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildApiEnvelope(MOCK_ROUTINE_PAYLOAD)),
    });
  });

  await page.route('**/api/v1/routines/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildApiEnvelope(MOCK_ROUTINE_PAYLOAD)),
    });
  });

  await page.route('**/api/v1/air-quality/current*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          location: MOCK_ROUTINE_PAYLOAD.location,
          aqi: {
            usAqi: MOCK_ROUTINE_PAYLOAD.airQualityContext.usAqi,
            europeanAqi: MOCK_ROUTINE_PAYLOAD.airQualityContext.europeanAqi,
            dominantPollutant: MOCK_ROUTINE_PAYLOAD.airQualityContext.dominantPollutant,
          },
          pollutants: MOCK_ROUTINE_PAYLOAD.airQualityContext.pollutants,
          forecastPreview: [],
          guidance: {
            status: 'measured_evidence',
            headline: 'Guidance',
            summary: 'Summary',
            fogDistinctionNote: 'Fog note',
            guidanceScopeNote: 'Scope note',
            actions: [],
          },
          transparency: MOCK_ROUTINE_PAYLOAD.airQualityContext.transparency,
        }),
      ),
    });
  });

  await page.route('**/api/v1/indoor-air/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          guidanceId: 'e2e-indoor-stub-id',
          generatedAt: '2026-11-22T12:00:00Z',
          cachedResult: false,
          location: MOCK_ROUTINE_PAYLOAD.location,
          overview: {
            headline: 'Indoor Air Quality Assistant (Krakow)',
            summary: 'Tailored indoor air guidance.',
            householdSize: 4,
            householdComposition: ['adults', 'young_children'],
            ventilationContext: 'filtered_hvac_merv13',
            hasIndoorAirPurifier: true,
            heatingType: 'district',
            primaryZoneType: 'valley_basin',
            outdoorConditionSummary: 'Elevated outdoor particulates.',
            sensorStatus: {
              sensorConnected: false,
              disclosureStatement:
                'Indoor air quality is not being measured. These recommendations are based on your household settings, available outdoor air-quality information and general guidance.',
              evidenceDistinctions: [],
            },
          },
          airQualityContext: MOCK_ROUTINE_PAYLOAD.airQualityContext,
          scenarioContext: {
            selectedScenario: 'baseline',
            isSimulation: false,
            simulationLabel: 'Saved household baseline',
            scenarioTitle: 'Saved household baseline',
            scenarioDescription: 'Saved home setup.',
            scenarioFocusNotes: [],
            availableScenarios: [],
          },
          ventilationGuidance: {
            state: 'delay_optional_ventilation',
            stateLabel: 'Delay optional window airing',
            headline: 'Delay optional window airing',
            summary: 'Use indoor filtered airflow.',
            bestWindowHint: null,
            windowDisclosure: 'Model forecast timing window.',
            essentialSafetyReminder: 'Never seal combustion vents or smoke alarms.',
            constraintsAndTradeoffs: ['Outdoor model estimate only.'],
            informationCategory: 'estimated_inferred_indoor',
          },
          purifierGuidance: {
            hasPurifier: true,
            scenarioSimulatedPurifier: false,
            headline: 'Portable HEPA Purifier Guidance',
            summary: 'Run HEPA unit.',
            practicalGuidance: ['Close doors to active rooms.'],
            gasAndVocLimitation: 'HEPA filters do not capture carbon monoxide or most gases.',
            nonPurchaseNote: null,
            informationCategory: 'general_educational_guidance',
          },
          actionPlan: [],
          pollutionSources: [],
          provenanceAndSafety: {
            dataSources: ['Household profile', 'Open-Meteo'],
            nonMedicalNotice: 'General educational guidance only.',
            limitationsSummary: 'No indoor sensors.',
          },
        }),
      ),
    });
  });

  await page.route('**/api/v1/alternatives/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          advisoryId: 'e2e-alt-stub-id',
          generatedAt: '2026-11-23T09:00:00Z',
          cachedResult: false,
          location: MOCK_ROUTINE_PAYLOAD.location,
          overview: {
            headline: 'Sustainable Alternatives Advisor (Krakow)',
            summary: 'Tailored household alternatives.',
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
              householdSize: 4,
              householdComposition: ['adults', 'young_children'],
              primaryCommuteMode: 'public_transit',
              heatingType: 'district',
              ventilationContext: 'filtered_hvac_merv13',
              primaryZoneType: 'valley_basin',
            },
            outdoorConditionSummary: 'Outdoor telemetry summary.',
            impactDistinctionLegend: [],
            activeTransportAqiNote: 'Condition-aware active travel guidance.',
          },
          appliedFilters: {
            category: null,
            affordability: null,
            relevance: null,
            impactType: null,
            practicality: null,
          },
          airQualityContext: {
            usAqi: MOCK_ROUTINE_PAYLOAD.airQualityContext.usAqi,
            europeanAqi: MOCK_ROUTINE_PAYLOAD.airQualityContext.europeanAqi,
            dominantPollutant: MOCK_ROUTINE_PAYLOAD.airQualityContext.dominantPollutant,
            transparency: MOCK_ROUTINE_PAYLOAD.airQualityContext.transparency,
          },
          alternatives: [],
          featuredComparison: null,
          provenanceAndDisclosures: {
            dataSources: ['Household profile', 'Open-Meteo'],
            methodologicalPrinciples: ['Qualitative only.'],
            limitationsSummary: 'Conditional on local infrastructure.',
          },
        }),
      ),
    });
  });

  await page.route('**/api/v1/advisory/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          briefingId: 'e2e-briefing-stub',
          location: MOCK_ROUTINE_PAYLOAD.location,
          householdSummary: {
            city: 'Krakow',
            neighborhood: 'Krowodrza',
            primaryZoneType: 'valley_basin',
            householdSize: 4,
            householdComposition: ['adults', 'young_children'],
            primaryCommuteMode: 'gas_vehicle',
            outdoorActivityPattern: 'school_run_family',
            ventilationContext: 'filtered_hvac_merv13',
            hasIndoorAirPurifier: true,
            heatingType: 'district',
            preferredGuidanceFocus: 'balanced',
          },
          airQualitySnapshot: {
            freshnessStatus: 'fresh',
            availabilityStatus: 'available',
            observationTimestamp: '2026-11-23T09:00:00Z',
            usAqiValue: 74,
            usAqiCategory: 'Moderate',
            europeanAqiValue: 48,
            europeanAqiCategory: 'Moderate',
            dominantPollutantCode: 'pm2_5',
            dominantPollutantLabel: 'PM2.5',
            isHighOrWorse: false,
            isElevatedOrWorse: false,
            isCyclingNotAdvised: false,
            bestForecastWindowLabel: null,
            aqSummary: 'Advisory summary.',
            activeScaleNote: 'dual_epa_eea',
          },
          headline: 'Daily briefing (Krakow)',
          summary: 'Grounded summary.',
          outdoorInfluenceSummary: 'Outdoor note.',
          indoorContextSummary: 'Indoor context note.',
          priorityActions: [],
          cautionsAndLimitations: 'Educational guidance only.',
          verifiedEvidence: [],
          availableRecommendations: [],
          generationMeta: {
            generationMode: 'gemini',
            model: 'gemini-4-hydrogen',
            fallbackReason: null,
            aiDisclosure: 'AI-generated explanation grounded in VAYORA deterministic rules.',
            nonMedicalNotice: 'Educational guidance only.',
            freshnessDisclosure: 'fresh',
            freshnessMessage: 'Fresh model data.',
            contextFingerprint: 'e2e-fp',
            cachedResult: false,
            generatedAt: '2026-11-23T09:00:00Z',
            latencyMs: 30,
            focus: 'balanced',
          },
        }),
      ),
    });
  });
}

test.describe('Phase 3 Low-Emission Daily Routines (E2E & WCAG 2.2 AA)', () => {
  test('enforces unauthenticated protection on routine endpoints', async ({ page }) => {
    const dailyRes = await page.request.get('/api/v1/routines/daily');
    expect(dailyRes.status()).toBe(401);

    const refreshRes = await page.request.post('/api/v1/routines/refresh', { data: {} });
    expect(refreshRes.status()).toBe(401);
  });

  test('renders daily routines workspace, overview metrics, time windows, commute strategy, and passes accessibility audit', async ({
    page,
  }) => {
    await setupRoutinesE2ERoutes(page);
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');

    await expect(page.getByTestId('daily-routines-workspace')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Low-Emission Daily Routines/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: /Comparatively Better Outdoor Time Windows/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: /Commute & Travel Strategy/i }),
    ).toBeVisible();
    await expect(page.getByTestId('routine-card-morning-school-family-routine')).toBeVisible();

    // Test impact filtering
    await page
      .getByTestId('daily-routines-workspace')
      .getByRole('button', { name: 'Personal exposure', exact: true })
      .click();
    await expect(page.getByTestId('routine-card-morning-school-family-routine')).toBeVisible();

    // Refresh routines
    await page.getByRole('button', { name: 'Refresh routines' }).click();

    // Full-page WCAG 2.2 AA audit
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
