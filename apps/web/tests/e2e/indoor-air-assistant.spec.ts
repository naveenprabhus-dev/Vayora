import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function buildApiEnvelope<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      requestId: 'e2e-indoor-req-1',
      timestamp: '2026-11-22T12:00:00.000Z',
    },
  };
}

function createIndoorPayload(options?: {
  readonly scenario?: string;
  readonly freshness?: 'fresh' | 'stale' | 'unavailable';
}) {
  const scenario = options?.scenario ?? 'baseline';
  const freshness = options?.freshness ?? 'fresh';
  const isUnavailable = freshness === 'unavailable';
  const isSimulation = scenario !== 'baseline';

  return {
    guidanceId: `uid_e2e_family::${scenario}::${freshness}`,
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
    overview: {
      headline: 'Indoor Air Quality Assistant (Krakow)',
      summary:
        'Tailored indoor ventilation, filtration, and source-control guidance derived from your household setup and available outdoor telemetry.',
      householdSize: 4,
      householdComposition: ['adults', 'young_children'],
      ventilationContext: 'natural_windows',
      hasIndoorAirPurifier: true,
      heatingType: 'district',
      primaryZoneType: 'valley_basin',
      outdoorConditionSummary: isUnavailable
        ? 'Outdoor telemetry is unavailable.'
        : 'Elevated outdoor winter PM2.5 (39.8 µg/m³).',
      sensorStatus: {
        sensorConnected: false,
        disclosureStatement:
          'Indoor air quality is not being measured. These recommendations are based on your household settings, available outdoor air-quality information and general guidance.',
        evidenceDistinctions: [
          {
            category: 'measured_indoor',
            label: 'Measured indoor air quality',
            statusLabel: 'Not measured (no indoor sensors connected)',
            description: 'No indoor sensors connected; VAYORA never fabricates indoor readings.',
          },
          {
            category: 'outdoor_air_quality',
            label: 'Outdoor air-quality information',
            statusLabel: isUnavailable
              ? 'Unavailable'
              : freshness === 'stale'
                ? 'Stale cached model data'
                : 'Fresh Open-Meteo model forecast',
            description: 'Open-Meteo atmospheric chemistry forecast.',
          },
          {
            category: 'estimated_inferred_indoor',
            label: 'Estimated or inferred indoor conditions',
            statusLabel: 'Qualitative setup inference only',
            description: 'Inferred qualitatively from saved ventilation and heating setup.',
          },
          {
            category: 'general_educational_guidance',
            label: 'General educational guidance',
            statusLabel: 'Public-health hygiene & safety principles',
            description: 'Source-control steps and chemical safety limits.',
          },
        ],
      },
    },
    airQualityContext: {
      usAqi: {
        scale: 'us_aqi',
        scaleLabel: 'US AQI (EPA)',
        authorityLabel: 'U.S. EPA 0–500 Scale',
        value: isUnavailable ? null : 112,
        status: isUnavailable ? 'unavailable' : 'available',
        category: isUnavailable ? 'Unavailable' : 'Unhealthy for Sensitive Groups',
        pollutionLevel: isUnavailable ? 'unavailable' : 'moderate',
        pollutionLevelLabel: isUnavailable ? 'Unavailable' : 'Moderate–elevated pollution level',
        severityToken: isUnavailable ? 'unavailable' : 'elevated',
        meaning: 'Elevated winter PM2.5 accumulation.',
        precautionSummary: 'Keep windows closed during traffic peaks.',
        methodologyNote: 'US EPA.',
      },
      europeanAqi: {
        scale: 'european_aqi',
        scaleLabel: 'European AQI (EEA)',
        authorityLabel: 'EEA 0–100+ Index',
        value: isUnavailable ? null : 64,
        status: isUnavailable ? 'unavailable' : 'available',
        category: isUnavailable ? 'Unavailable' : 'Poor',
        pollutionLevel: isUnavailable ? 'unavailable' : 'high',
        pollutionLevelLabel: isUnavailable ? 'Unavailable' : 'High pollution level',
        severityToken: isUnavailable ? 'unavailable' : 'high',
        meaning: 'Poor air quality index.',
        precautionSummary: 'Run indoor filtration.',
        methodologyNote: 'EEA.',
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
            estimatedSubIndex: 112,
            explanation: 'PM2.5 dominates.',
          },
      pollutants: [],
      transparency: {
        providerId: 'open-meteo',
        providerName: 'Open-Meteo Air Quality',
        dataNature: isUnavailable ? 'unavailable' : 'model_forecast',
        dataNatureDisclosure: 'Model forecast.',
        attribution: 'Data provided by Open-Meteo.com (CC BY 4.0)',
        freshnessStatus: freshness,
        availabilityStatus: isUnavailable ? 'unavailable' : 'available',
        observationTimestamp: isUnavailable ? null : '2026-11-22T12:00:00Z',
        fetchedAt: '2026-11-22T12:01:00Z',
        cacheAgeSeconds: freshness === 'stale' ? 2400 : 12,
        fallbackActive: freshness !== 'fresh',
        fallbackReason: freshness === 'stale' ? 'Cached readings in use.' : null,
        methodologySummary: 'Independent scales.',
      },
    },
    scenarioContext: {
      selectedScenario: scenario,
      isSimulation,
      simulationLabel: isSimulation
        ? 'Illustrative scenario simulation — not an indoor sensor measurement or permanent profile change.'
        : 'Saved household baseline (no active simulation)',
      scenarioTitle:
        scenario === 'cooking'
          ? 'Cooking at home'
          : scenario === 'cleaning'
            ? 'Cleaning the house'
            : 'Saved household baseline',
      scenarioDescription:
        scenario === 'cooking'
          ? 'Simulates stovetop cooking particulates, grease aerosols, and exhaust controls.'
          : 'Guidance tailored to your saved household profile.',
      scenarioFocusNotes:
        scenario === 'cooking'
          ? ['Turn on vented range exhaust fan before high-heat cooking.']
          : [],
      availableScenarios: [
        { id: 'baseline', label: 'Saved household baseline', shortDescription: 'Baseline.' },
        { id: 'cooking', label: 'Cooking at home', shortDescription: 'Cooking simulation.' },
        { id: 'cleaning', label: 'Cleaning the house', shortDescription: 'Cleaning simulation.' },
        { id: 'opening_windows', label: 'Opening windows', shortDescription: 'Window simulation.' },
        {
          id: 'operating_purifier',
          label: 'Operating an air purifier',
          shortDescription: 'Purifier simulation.',
        },
        {
          id: 'elevated_outdoor_pollution',
          label: 'Elevated outdoor pollution',
          shortDescription: 'Smog episode simulation.',
        },
      ],
    },
    ventilationGuidance: {
      state: isUnavailable ? 'insufficient_data' : 'delay_optional_ventilation',
      stateLabel: isUnavailable
        ? 'Insufficient outdoor data'
        : 'Delay optional ventilation where safe',
      headline: isUnavailable
        ? 'Live outdoor telemetry unavailable — maintain essential ventilation'
        : 'Delay optional window airing during elevated outdoor PM2.5',
      summary: 'Keep street-facing windows shut while outdoor PM2.5 stays elevated.',
      bestWindowHint: isUnavailable ? null : 'Midday dispersion window (11:00 – 14:00)',
      windowDisclosure: 'Model-derived forecast window.',
      essentialSafetyReminder:
        'Never seal combustion vents, fuel-burning appliance air intakes, or emergency smoke pathways.',
      constraintsAndTradeoffs: ['No indoor air sensor connected.'],
      informationCategory: 'estimated_inferred_indoor',
    },
    purifierGuidance: {
      hasPurifier: true,
      scenarioSimulatedPurifier: false,
      headline: 'Portable HEPA Purifier Operating Guidance',
      summary: 'Operate HEPA filtration continuously in occupied rooms.',
      practicalGuidance: ['Keep unit unobstructed in main living space.'],
      gasAndVocLimitation:
        'Standard HEPA particle filters do not capture carbon monoxide (CO) and have limited or no effect on cleaning VOCs or combustion gases.',
      nonPurchaseNote: null,
      informationCategory: 'general_educational_guidance',
    },
    actionPlan: [
      {
        id: 'indoor-ventilation-timing',
        title: 'Delay optional window airing during elevated outdoor pollution',
        status: 'recommended',
        statusLabel: 'Recommended',
        priorityScore: 92,
        informationCategory: 'estimated_inferred_indoor',
        informationCategoryLabel: 'Estimated or inferred indoor condition',
        whatToDo:
          'Keep windows closed during rush-hour peaks unless clearing indoor cooking smoke.',
        whyRecommended: 'Outdoor US AQI is 112 with elevated PM2.5.',
        householdAndOutdoorContext: ['Natural windows', 'US AQI 112'],
        precautionAndSafety: 'Never block mandatory combustion air intakes.',
        limitations: 'Estimated from outdoor model only.',
        highlightedByScenario: scenario === 'opening_windows',
      },
      {
        id: 'indoor-cleaning-chemical-safety',
        title: 'Use damp wiping & low-VOC cleaning habits',
        status: scenario === 'cleaning' ? 'recommended' : 'optional',
        statusLabel: scenario === 'cleaning' ? 'Recommended' : 'Optional',
        priorityScore: 80,
        informationCategory: 'general_educational_guidance',
        informationCategoryLabel: 'General educational guidance',
        whatToDo: 'Apply liquid cleaner onto a cloth instead of spraying aerosols.',
        whyRecommended: 'Reduces suspended cleaning droplets and irritating vapors.',
        householdAndOutdoorContext: ['General indoor chemical safety'],
        precautionAndSafety: 'NEVER mix chlorine bleach with ammonia or vinegar.',
        limitations: 'HEPA filters do not capture cleaning vapors.',
        highlightedByScenario: scenario === 'cleaning',
      },
    ],
    pollutionSources: [
      {
        id: 'cooking_emissions',
        title: 'Cooking emissions (particulates, grease aerosols & combustion gases)',
        whatItIs: 'Fine particles and combustion gases released while cooking.',
        howItAffectsIndoorAir: 'High-heat searing elevates indoor particles rapidly.',
        practicalReductionSteps: ['Use vented range hoods and pot lids.'],
        relevantPrecautions: ['Never heat your home with a gas oven.'],
        limitations: 'Qualitative educational guidance only.',
        informationCategory: 'general_educational_guidance',
        sourceReference: 'General US EPA / WHO educational guidance.',
      },
      {
        id: 'cleaning_products_and_aerosols',
        title: 'Cleaning products, sprays, and household aerosols',
        whatItIs: 'VOCs and aerosol sprays released while cleaning.',
        howItAffectsIndoorAir: 'Suspends chemical vapors in indoor rooms.',
        practicalReductionSteps: ['Wipe with damp microfiber cloths.'],
        relevantPrecautions: ['NEVER mix bleach with ammonia or acids.'],
        limitations: 'HEPA filters do not capture VOCs.',
        informationCategory: 'general_educational_guidance',
        sourceReference: 'Public indoor chemical safety guidance.',
      },
      {
        id: 'outdoor_infiltration',
        title: 'Outdoor pollution entering through windows, doors & gaps',
        whatItIs: 'Winter smog and traffic exhaust entering indoors.',
        howItAffectsIndoorAir: 'Gradually raises indoor baseline particulate levels.',
        practicalReductionSteps: ['Close street-facing windows during rush hour.'],
        relevantPrecautions: ['Keep safety and appliance vents unobstructed.'],
        limitations: 'Infiltration varies by building envelope.',
        informationCategory: 'general_educational_guidance',
        sourceReference: 'US EPA infiltration educational principles.',
      },
    ],
    provenanceAndSafety: {
      dataSources: ['Saved VAYORA Household Profile', 'Open-Meteo CC BY 4.0'],
      nonMedicalNotice:
        'General educational and environmental guidance only. VAYORA does not provide medical diagnoses.',
      limitationsSummary: 'No indoor sensors connected.',
    },
  };
}

async function setupIndoorE2ERoutes(
  page: Page,
  options?: { readonly freshness?: 'fresh' | 'stale' | 'unavailable' },
) {
  const freshness = options?.freshness ?? 'fresh';

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
            ventilationContext: 'natural_windows',
            hasIndoorAirPurifier: true,
            heatingType: 'district',
            lifestylePreferences: {
              preferredGuidanceFocus: 'indoor_air',
              reminderCadence: 'daily_smog_alerts',
            },
            onboardingCompleted: true,
          },
        }),
      ),
    });
  });

  const payload = createIndoorPayload({ freshness });
  await page.route('**/api/v1/air-quality/current*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          location: payload.location,
          aqi: {
            usAqi: payload.airQualityContext.usAqi,
            europeanAqi: payload.airQualityContext.europeanAqi,
            dominantPollutant: payload.airQualityContext.dominantPollutant,
          },
          pollutants: [],
          forecastPreview: [],
          guidance: {
            status: freshness === 'unavailable' ? 'general_precaution' : 'measured_evidence',
            headline: 'Outdoor Air Summary',
            summary: 'Summary',
            fogDistinctionNote: 'Fog is distinct from winter smog.',
            guidanceScopeNote: 'Scope',
            actions: [],
          },
          transparency: payload.airQualityContext.transparency,
        }),
      ),
    });
  });

  await page.route('**/api/v1/routines/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          routineId: 'e2e-routine-id',
          generatedAt: '2026-11-22T12:00:00Z',
          cachedResult: false,
          location: payload.location,
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
            preferredGuidanceFocus: 'indoor_air',
            isScenarioPreview: false,
          },
          airQualityContext: payload.airQualityContext,
          overview: {
            headline: 'Low-Emission Daily Routines',
            summary: 'Summary',
            totalRecommended: 1,
            totalOptional: 0,
            totalUnavailable: 0,
            exposureCount: 1,
            emissionCount: 0,
            bothCount: 0,
            safetyAndScopeNotice: 'Educational guidance.',
          },
          betterTimeWindows: {
            status: 'unavailable',
            windows: [],
            limitationDisclosure: 'No forecast.',
          },
          commuteSummary: {
            savedMode: 'gas_vehicle',
            effectiveMode: 'gas_vehicle',
            headline: 'Commute Strategy',
            exposureVsEmissionsNote: 'Transit note.',
            options: [],
          },
          periods: [],
        }),
      ),
    });
  });

  await page.route('**/api/v1/indoor-air/guidance*', async (route) => {
    const url = new URL(route.request().url());
    const scenario = url.searchParams.get('scenario') ?? 'baseline';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildApiEnvelope(createIndoorPayload({ scenario, freshness }))),
    });
  });

  await page.route('**/api/v1/indoor-air/refresh', async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as { scenario?: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope(createIndoorPayload({ scenario: body.scenario ?? 'baseline', freshness })),
      ),
    });
  });

  await page.route('**/api/v1/alternatives/**', async (route) => {
    const indoor = createIndoorPayload({ freshness });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          advisoryId: 'e2e-alt-stub-id',
          generatedAt: '2026-11-23T09:00:00Z',
          cachedResult: false,
          location: indoor.location,
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
              primaryCommuteMode: 'gas_vehicle',
              heatingType: 'district',
              ventilationContext: 'natural_windows',
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
            usAqi: indoor.airQualityContext.usAqi,
            europeanAqi: indoor.airQualityContext.europeanAqi,
            dominantPollutant: indoor.airQualityContext.dominantPollutant,
            transparency: indoor.airQualityContext.transparency,
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
    const indoor = createIndoorPayload({ freshness });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          briefingId: 'e2e-briefing-stub',
          location: indoor.location,
          householdSummary: {
            city: 'Krakow',
            neighborhood: 'Krowodrza',
            primaryZoneType: 'valley_basin',
            householdSize: 4,
            householdComposition: ['adults', 'young_children'],
            primaryCommuteMode: 'gas_vehicle',
            outdoorActivityPattern: 'school_run_family',
            ventilationContext: 'natural_windows',
            hasIndoorAirPurifier: true,
            heatingType: 'district',
            preferredGuidanceFocus: 'indoor_air',
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

test.describe('Phase 4 Indoor Air Quality Assistant (E2E & WCAG 2.2 AA)', () => {
  test('enforces unauthenticated protection on indoor air endpoints', async ({ page }) => {
    const guidanceRes = await page.request.get('/api/v1/indoor-air/guidance');
    expect(guidanceRes.status()).toBe(401);

    const refreshRes = await page.request.post('/api/v1/indoor-air/refresh', { data: {} });
    expect(refreshRes.status()).toBe(401);
  });

  test('renders indoor workspace, missing sensor disclosure, 4-way distinction matrix, scenario switching, source filter, and passes WCAG 2.2 AA across desktop & mobile', async ({
    page,
  }) => {
    await setupIndoorE2ERoutes(page, { freshness: 'fresh' });
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');

    await expect(page.getByTestId('indoor-air-assistant-workspace')).toBeVisible();
    await expect(page.getByTestId('indoor-sensor-disclosure')).toContainText(
      'Indoor air quality is not being measured. These recommendations are based on your household settings, available outdoor air-quality information and general guidance.',
    );

    await expect(page.getByTestId('evidence-distinction-measured_indoor')).toBeVisible();
    await expect(page.getByTestId('evidence-distinction-outdoor_air_quality')).toBeVisible();
    await expect(page.getByTestId('evidence-distinction-estimated_inferred_indoor')).toBeVisible();
    await expect(
      page.getByTestId('evidence-distinction-general_educational_guidance'),
    ).toBeVisible();

    await expect(page.getByTestId('hepa-gas-limitation')).toContainText(
      /do not capture carbon monoxide/i,
    );

    // Scenario switching
    await page.getByRole('button', { name: 'Cooking at home' }).click();
    await expect(page.getByTestId('indoor-simulation-banner')).toContainText(
      /Illustrative scenario simulation/i,
    );

    // Pollution source filter
    await page.getByRole('button', { name: /Cleaning products/i }).click();
    await expect(page.getByTestId('indoor-source-cleaning_products_and_aerosols')).toBeVisible();
    await expect(page.getByTestId('indoor-source-cooking_emissions')).toBeHidden();

    // Refresh indoor guidance
    await page.getByRole('button', { name: 'Refresh indoor guidance' }).click();

    // No horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);

    // Full-page WCAG 2.2 AA check
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('renders honest unavailable and stale telemetry disclosures without fabricating indoor readings', async ({
    page,
  }) => {
    await setupIndoorE2ERoutes(page, { freshness: 'stale' });
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');
    await expect(
      page
        .getByTestId('indoor-air-assistant-workspace')
        .getByText(/Outdoor telemetry is stale cached data/i),
    ).toBeVisible();

    await page.unrouteAll();
    await setupIndoorE2ERoutes(page, { freshness: 'unavailable' });
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');
    await expect(
      page.getByText(/Live outdoor telemetry unavailable — safety & educational guidance active/i),
    ).toBeVisible();
    await expect(page.getByText('Insufficient outdoor data', { exact: true })).toBeVisible();
  });
});
