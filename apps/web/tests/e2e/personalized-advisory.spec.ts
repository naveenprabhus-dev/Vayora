import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function buildApiEnvelope<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      requestId: 'e2e-adv-req-1',
      timestamp: '2026-11-23T09:00:00.000Z',
    },
  };
}

const BASE_LOCATION = {
  city: 'Krakow',
  neighborhood: 'Krowodrza',
  country: 'Poland',
  postalPrefix: '30-01',
  resolvedLabel: 'Krakow, Poland',
  latitude: 50.061,
  longitude: 19.937,
  timezone: 'Europe/Warsaw',
  resolutionSource: 'saved_profile_geocoded',
};

function createBriefingPayload(options?: {
  readonly mode?: 'gemini' | 'deterministic_fallback';
  readonly freshness?: 'fresh' | 'unavailable';
  readonly cachedResult?: boolean;
}) {
  const mode = options?.mode ?? 'gemini';
  const freshness = options?.freshness ?? 'fresh';
  const cachedResult = options?.cachedResult ?? false;

  return {
    briefingId: 'uid_e2e_family::briefing::phase6',
    location: BASE_LOCATION,
    householdSummary: {
      city: 'Krakow',
      neighborhood: 'Krowodrza',
      primaryZoneType: 'valley_basin',
      householdSize: 4,
      householdComposition: ['adults', 'young_children'],
      primaryCommuteMode: 'gas_vehicle',
      outdoorActivityPattern: 'school_run_family',
      ventilationContext: 'natural_windows',
      hasIndoorAirPurifier: false,
      heatingType: 'solid_fuel',
      preferredGuidanceFocus: 'balanced',
    },
    airQualitySnapshot: {
      freshnessStatus: freshness,
      availabilityStatus: freshness === 'unavailable' ? 'unavailable' : 'available',
      observationTimestamp: freshness === 'unavailable' ? null : '2026-11-23T09:00:00Z',
      usAqiValue: freshness === 'unavailable' ? null : 182,
      usAqiCategory: freshness === 'unavailable' ? 'Unavailable' : 'Unhealthy',
      europeanAqiValue: freshness === 'unavailable' ? null : 88,
      europeanAqiCategory: freshness === 'unavailable' ? 'Unavailable' : 'Poor',
      dominantPollutantCode: freshness === 'unavailable' ? null : 'pm2_5',
      dominantPollutantLabel: freshness === 'unavailable' ? null : 'PM2.5',
      isHighOrWorse: freshness !== 'unavailable',
      isElevatedOrWorse: freshness !== 'unavailable',
      isCyclingNotAdvised: freshness !== 'unavailable',
      bestForecastWindowLabel: null,
      aqSummary: freshness === 'unavailable' ? 'Unavailable.' : 'US AQI 182 (Unhealthy).',
      activeScaleNote: 'dual_epa_eea',
    },
    headline:
      mode === 'deterministic_fallback'
        ? 'Grounded fallback plan: bundle car errands and minimize indoor smoke'
        : 'Protect indoor air and bundle car errands in Krakow today',
    summary:
      'High particulate burden calls for avoiding strenuous outdoor cycling while cutting cold-start car exhaust.',
    outdoorInfluenceSummary: 'US AQI 182 places particulate matter in the unhealthy band.',
    indoorContextSummary: 'No indoor sensors are connected; guidance relies on saved home setup.',
    priorityActions: [
      {
        recommendationId: 'transport-trip-chaining-no-idling',
        sourceModule: 'alternatives',
        title: 'Combine household errands and eliminate unnecessary vehicle idling',
        rationale: 'Lowers repeated cold-start exhaust bursts near sidewalks.',
        impactCategory: 'local_emissions',
        impactCategoryLabel: 'Local air pollutant emissions reduction',
        deterministicStatus: 'recommended',
      },
      {
        recommendationId: 'indoor-source-cooking',
        sourceModule: 'indoor',
        title: 'Vent kitchen fumes directly outdoors while cooking',
        rationale: 'Prevents cooking particle accumulation without full-house airing.',
        impactCategory: 'personal_exposure',
        impactCategoryLabel: 'Personal exposure reduction',
        deterministicStatus: 'recommended_now',
      },
    ],
    cautionsAndLimitations:
      'Educational environmental guidance only; maintain working smoke and carbon monoxide alarms.',
    verifiedEvidence: [
      {
        id: 'EV-OPEN-METEO',
        sourceName: 'Open-Meteo Air Quality',
        sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
        scope: 'Outdoor atmospheric model telemetry',
        relevantFinding: 'PM2.5 dominates current outdoor particulate burden.',
        limitations: 'Atmospheric forecast model rather than wearable sensors.',
      },
    ],
    availableRecommendations: [
      {
        recommendationId: 'transport-trip-chaining-no-idling',
        sourceModule: 'alternatives',
        title: 'Combine household errands and eliminate unnecessary vehicle idling',
        status: 'recommended',
        statusLabel: 'Suitable now',
        impactCategory: 'local_emissions',
        impactCategoryLabel: 'Local air pollutant emissions reduction',
        summary: 'Group errands into one planned loop and turn off ignition while parked.',
        whyRecommended: 'Cold-start vehicle trips emit elevated NO2 and soot.',
        limitations: 'Requires household errand scheduling.',
        evidenceIds: ['EV-OPEN-METEO'],
      },
      {
        recommendationId: 'indoor-source-cooking',
        sourceModule: 'indoor',
        title: 'Vent kitchen fumes directly outdoors while cooking',
        status: 'recommended_now',
        statusLabel: 'Recommended now',
        impactCategory: 'personal_exposure',
        impactCategoryLabel: 'Personal exposure reduction',
        summary: 'Use range extraction while cooking.',
        whyRecommended: 'Reduces indoor particle accumulation.',
        limitations: 'No indoor sensors connected.',
        evidenceIds: ['EV-OPEN-METEO'],
      },
    ],
    generationMeta: {
      generationMode: mode,
      model: 'gemini-4-hydrogen',
      fallbackReason:
        mode === 'deterministic_fallback'
          ? 'Gemini exceeded the timeout budget; deterministic fallback activated.'
          : null,
      aiDisclosure:
        mode === 'gemini'
          ? 'AI-generated explanation grounded strictly in VAYORA deterministic rules.'
          : 'Deterministic grounded explanation generated directly from VAYORA verified rules.',
      nonMedicalNotice: 'Educational guidance only.',
      freshnessDisclosure: freshness,
      freshnessMessage:
        freshness === 'unavailable'
          ? 'Live outdoor air-quality telemetry is unavailable right now.'
          : 'Fresh Open-Meteo outdoor atmospheric model data.',
      contextFingerprint: 'uid_e2e_family::briefing::phase6',
      cachedResult,
      generatedAt: '2026-11-23T09:00:00Z',
      latencyMs: 42,
      focus: 'balanced',
    },
  };
}

async function setupPhase6E2ERoutes(
  page: Page,
  options?: {
    readonly mode?: 'gemini' | 'deterministic_fallback';
    readonly freshness?: 'fresh' | 'unavailable';
  },
) {
  const mode = options?.mode ?? 'gemini';
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
            email: 'family@example.org',
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
            hasIndoorAirPurifier: false,
            heatingType: 'solid_fuel',
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

  const aqContext = {
    usAqi: {
      scale: 'us_aqi',
      scaleLabel: 'US AQI (EPA)',
      authorityLabel: 'U.S. EPA',
      value: freshness === 'unavailable' ? null : 182,
      status: freshness === 'unavailable' ? 'unavailable' : 'available',
      category: freshness === 'unavailable' ? 'Unavailable' : 'Unhealthy',
      pollutionLevel: freshness === 'unavailable' ? 'unavailable' : 'high',
      pollutionLevelLabel: freshness === 'unavailable' ? 'Unavailable' : 'High pollution level',
      severityToken: freshness === 'unavailable' ? 'unavailable' : 'high',
      meaning: 'Elevated PM2.5.',
      precautionSummary: 'Limit exertion.',
      methodologyNote: 'US EPA.',
    },
    europeanAqi: {
      scale: 'european_aqi',
      scaleLabel: 'European AQI (EEA)',
      authorityLabel: 'EEA',
      value: freshness === 'unavailable' ? null : 88,
      status: freshness === 'unavailable' ? 'unavailable' : 'available',
      category: freshness === 'unavailable' ? 'Unavailable' : 'Poor',
      pollutionLevel: freshness === 'unavailable' ? 'unavailable' : 'high',
      pollutionLevelLabel: freshness === 'unavailable' ? 'Unavailable' : 'High pollution level',
      severityToken: freshness === 'unavailable' ? 'unavailable' : 'high',
      meaning: 'Poor air quality.',
      precautionSummary: 'Limit exercise.',
      methodologyNote: 'EEA.',
    },
    dominantPollutant: {
      status: freshness === 'unavailable' ? 'unavailable' : 'available',
      code: freshness === 'unavailable' ? null : 'pm2_5',
      abbreviation: freshness === 'unavailable' ? null : 'PM2.5',
      fullName: freshness === 'unavailable' ? null : 'Fine Particulate Matter',
      basis: freshness === 'unavailable' ? 'unavailable' : 'provider_sub_index',
      estimatedSubIndex: freshness === 'unavailable' ? null : 182,
      explanation: 'PM2.5 dominates.',
    },
    transparency: {
      providerId: 'open-meteo',
      providerName: 'Open-Meteo',
      dataNature: freshness === 'unavailable' ? 'unavailable' : 'model_forecast',
      dataNatureDisclosure: 'Model forecast.',
      attribution: 'Open-Meteo CC BY 4.0',
      freshnessStatus: freshness,
      availabilityStatus: freshness === 'unavailable' ? 'unavailable' : 'available',
      observationTimestamp: freshness === 'unavailable' ? null : '2026-11-23T09:00:00Z',
      fetchedAt: '2026-11-23T09:01:00Z',
      cacheAgeSeconds: 10,
      fallbackActive: freshness !== 'fresh',
      fallbackReason: null,
      methodologySummary: 'Independent scales.',
    },
  };

  await page.route('**/api/v1/air-quality/current*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          location: BASE_LOCATION,
          aqi: {
            usAqi: aqContext.usAqi,
            europeanAqi: aqContext.europeanAqi,
            dominantPollutant: aqContext.dominantPollutant,
          },
          pollutants: [],
          forecastPreview: [],
          guidance: {
            status: 'measured_evidence',
            headline: 'High PM2.5',
            summary: 'Limit exertion.',
            fogDistinctionNote: 'Fog vs smog.',
            guidanceScopeNote: 'Educational.',
            actions: [],
          },
          transparency: aqContext.transparency,
        }),
      ),
    });
  });

  await page.route('**/api/v1/air-quality/forecast*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          location: BASE_LOCATION,
          horizonHours: 24,
          hourly: [],
          transparency: aqContext.transparency,
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
          routineId: 'e2e-routine-stub',
          generatedAt: '2026-11-23T09:00:00Z',
          cachedResult: false,
          location: BASE_LOCATION,
          profileContext: {
            primaryZoneType: 'valley_basin',
            householdSize: 4,
            householdComposition: ['adults', 'young_children'],
            savedCommuteMode: 'gas_vehicle',
            effectiveCommuteMode: 'gas_vehicle',
            savedOutdoorPattern: 'school_run_family',
            effectiveOutdoorPattern: 'school_run_family',
            heatingType: 'solid_fuel',
            ventilationContext: 'natural_windows',
            hasIndoorAirPurifier: false,
            preferredGuidanceFocus: 'balanced',
            isScenarioPreview: false,
          },
          airQualityContext: { ...aqContext, pollutants: [] },
          overview: {
            headline: 'Low-Emission Daily Routines',
            summary: 'Summary.',
            totalRecommended: 0,
            totalOptional: 0,
            totalUnavailable: 0,
            exposureCount: 0,
            emissionCount: 0,
            bothCount: 0,
            safetyAndScopeNotice: 'Educational.',
          },
          betterTimeWindows: {
            status: 'unavailable',
            windows: [],
            limitationDisclosure: 'Model windows.',
          },
          commuteSummary: {
            savedMode: 'gas_vehicle',
            effectiveMode: 'gas_vehicle',
            headline: 'Commute Strategy',
            exposureVsEmissionsNote: 'Note.',
            options: [],
          },
          periods: [],
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
          guidanceId: 'e2e-indoor-stub',
          generatedAt: '2026-11-23T09:00:00Z',
          cachedResult: false,
          location: BASE_LOCATION,
          overview: {
            headline: 'Indoor Air Quality Assistant (Krakow)',
            summary: 'Summary.',
            householdSize: 4,
            householdComposition: ['adults', 'young_children'],
            ventilationContext: 'natural_windows',
            hasIndoorAirPurifier: false,
            heatingType: 'solid_fuel',
            primaryZoneType: 'valley_basin',
            outdoorConditionSummary: 'High PM2.5.',
            sensorStatus: {
              sensorConnected: false,
              disclosureStatement: 'No indoor sensors connected.',
              evidenceDistinctions: [],
            },
          },
          airQualityContext: { ...aqContext, pollutants: [] },
          scenarioContext: {
            selectedScenario: 'baseline',
            isSimulation: false,
            simulationLabel: 'Baseline',
            scenarioTitle: 'Baseline',
            scenarioDescription: 'Baseline.',
            scenarioFocusNotes: [],
            availableScenarios: [],
          },
          ventilationGuidance: {
            state: 'delay_optional_ventilation',
            stateLabel: 'Delay optional airing',
            headline: 'Delay airing',
            summary: 'Keep windows closed.',
            bestWindowHint: null,
            windowDisclosure: 'Model timing.',
            essentialSafetyReminder: 'Safety vents open.',
            constraintsAndTradeoffs: ['Estimate only.'],
            informationCategory: 'estimated_inferred_indoor',
          },
          purifierGuidance: {
            hasPurifier: false,
            scenarioSimulatedPurifier: false,
            headline: 'Source control',
            summary: 'Avoid indoor smoke.',
            practicalGuidance: ['Use range hood.'],
            gasAndVocLimitation: 'HEPA filters do not capture carbon monoxide.',
            nonPurchaseNote: 'No purifier purchase required.',
            informationCategory: 'general_educational_guidance',
          },
          actionPlan: [],
          pollutionSources: [],
          provenanceAndSafety: {
            dataSources: ['Household profile'],
            nonMedicalNotice: 'Educational.',
            limitationsSummary: 'No sensors.',
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
          advisoryId: 'e2e-alt-stub',
          generatedAt: '2026-11-23T09:00:00Z',
          cachedResult: false,
          location: BASE_LOCATION,
          overview: {
            headline: 'Sustainable Alternatives Advisor (Krakow)',
            summary: 'Summary.',
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
              heatingType: 'solid_fuel',
              ventilationContext: 'natural_windows',
              primaryZoneType: 'valley_basin',
            },
            outdoorConditionSummary: 'High PM2.5.',
            impactDistinctionLegend: [],
            activeTransportAqiNote: 'High AQI.',
          },
          appliedFilters: {
            category: null,
            affordability: null,
            relevance: null,
            impactType: null,
            practicality: null,
          },
          airQualityContext: aqContext,
          alternatives: [],
          featuredComparison: null,
          provenanceAndDisclosures: {
            dataSources: ['Profile'],
            methodologicalPrinciples: ['Qualitative.'],
            limitationsSummary: 'Conditional.',
          },
        }),
      ),
    });
  });

  await page.route('**/api/v1/advisory/briefing*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildApiEnvelope(createBriefingPayload({ mode, freshness }))),
    });
  });

  await page.route('**/api/v1/advisory/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope(createBriefingPayload({ mode, freshness, cachedResult: false })),
      ),
    });
  });

  await page.route('**/api/v1/advisory/explain-recommendation', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          explanationId: 'exp-e2e-1',
          recommendation: {
            recommendationId: 'transport-trip-chaining-no-idling',
            sourceModule: 'alternatives',
            title: 'Combine household errands and eliminate unnecessary vehicle idling',
            status: 'recommended',
            statusLabel: 'Suitable now',
            impactCategory: 'local_emissions',
            impactCategoryLabel: 'Local air pollutant emissions reduction',
            summary: 'Group errands into one planned loop and turn off ignition while parked.',
            whyRecommended: 'Cold-start vehicle trips emit elevated NO2 and soot.',
            limitations: 'Requires household errand scheduling.',
            evidenceIds: ['EV-OPEN-METEO'],
          },
          headline: 'Why combining car errands lowers street-level exhaust',
          contextualSummary: 'Bundling errands cuts cold-start exhaust bursts.',
          whyThisAppliesToHousehold: 'Matches your household gas-vehicle commute setup.',
          impactExplanation: {
            action: 'Combine separate short drives into one continuous errand loop.',
            reason: 'Cold catalytic converters emit higher local NO2 and soot.',
            expectedBenefit: 'Lowers neighborhood tailpipe emissions near sidewalks.',
            impactCategory: 'local_emissions',
            evidence: 'US EPA transportation emissions guidance & Open-Meteo model context.',
            limitations: 'Does not remove existing basin PM2.5 or replace indoor air safety.',
          },
          impactCategoryLabel: 'Local air pollutant emissions reduction',
          alternativeOrTradeoffNote: 'Requires advance schedule planning.',
          verifiedEvidence: [
            {
              id: 'EV-OPEN-METEO',
              sourceName: 'Open-Meteo Air Quality',
              sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
              scope: 'Outdoor model telemetry',
              relevantFinding: 'US AQI 182 PM2.5 burden.',
              limitations: 'Model forecast only.',
            },
          ],
          generationMeta: {
            generationMode: mode,
            model: 'gemini-4-hydrogen',
            fallbackReason: null,
            aiDisclosure:
              'AI-generated explanation grounded strictly in VAYORA deterministic rules.',
            nonMedicalNotice: 'Educational guidance only.',
            freshnessDisclosure: freshness,
            freshnessMessage: 'Fresh Open-Meteo model telemetry.',
            contextFingerprint: 'exp-fp',
            cachedResult: false,
            generatedAt: '2026-11-23T09:00:00Z',
            latencyMs: 35,
            focus: 'balanced',
          },
        }),
      ),
    });
  });

  await page.route('**/api/v1/advisory/compare-choices', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          comparisonExplanationId: 'cmp-e2e-1',
          deterministicComparison: {
            alternativeId: 'transport-trip-chaining-no-idling',
            alternativeTitle: 'Combine household errands and eliminate unnecessary vehicle idling',
            category: 'transportation',
            impactClassification: 'local_emissions',
            impactClassificationLabel: 'Reduces local emissions',
            affordabilityTier: 'zero_cost',
            affordabilityLabel: 'Zero cost',
            relevanceScope: 'outdoor',
            suitabilityStatus: 'recommended',
            selectedBaselineId: 'separate_cold_trips',
            selectedBaselineLabel: 'Separate cold-start trips & idling',
            availableBaselines: [],
            currentChoiceSummary: 'Daily unbundled short drives.',
            suggestedAlternativeSummary: 'Single bundled loop.',
            whyPreferable: 'Cuts cold-start exhaust bursts.',
            directAirQualityAndEmissionsEffect: 'Reduces localized NO2 and PM2.5 exhaust.',
            personalExposureEffect: 'Lower curbside exposure near school gates.',
            broaderSustainabilityEffect: 'Reduces fuel use qualitatively.',
            ghgVsLocalPollutantDistinction: 'Local tailpipe exhaust separated from CO2.',
            costAndAccessibility: 'Zero cost.',
            tradeoffsAndLimitations: 'Requires coordination.',
            infrastructureConditionality: null,
            evidenceReference: {
              sourceName: 'US EPA Transportation',
              sourceUrl: 'https://www.epa.gov/transportation-air-pollution-and-climate-change',
              relevantFinding: 'Combining trips reduces cold-start exhaust.',
              versionOrDate: 'EPA',
              limitations: 'Depends on traffic.',
            },
          },
          headline: 'Bundled errands vs. separate cold-start car runs',
          summary: 'Grouping trips lowers local tailpipe emissions cleanly.',
          currentChoiceImpact: 'Cold-start drives emit repeated exhaust plumes.',
          suggestedChoiceImpact: 'Single warm-engine route minimizes localized exhaust.',
          impactCategory: 'local_emissions',
          impactCategoryLabel: 'Local air pollutant emissions reduction',
          whyPreferableForHousehold:
            'Avoids strenuous high-AQI outdoor walking while cutting exhaust.',
          tradeoffsAndLimitations:
            'Requires errand coordination; does not filter indoor particles.',
          verifiedEvidence: [],
          generationMeta: {
            generationMode: mode,
            model: 'gemini-4-hydrogen',
            fallbackReason: null,
            aiDisclosure:
              'AI-generated explanation grounded strictly in VAYORA deterministic rules.',
            nonMedicalNotice: 'Educational guidance only.',
            freshnessDisclosure: freshness,
            freshnessMessage: 'Fresh Open-Meteo model telemetry.',
            contextFingerprint: 'cmp-fp',
            cachedResult: false,
            generatedAt: '2026-11-23T09:00:00Z',
            latencyMs: 38,
            focus: 'balanced',
          },
        }),
      ),
    });
  });
}

test.describe('Phase 6 GenAI Personalization & Impact Explanation Engine (E2E & WCAG 2.2 AA)', () => {
  test('enforces unauthenticated protection on all Phase 6 advisory endpoints', async ({
    page,
  }) => {
    const briefingRes = await page.request.get('/api/v1/advisory/briefing');
    expect(briefingRes.status()).toBe(401);

    const explainRes = await page.request.post('/api/v1/advisory/explain-recommendation', {
      data: {
        recommendationId: 'transport-trip-chaining-no-idling',
        sourceModule: 'alternatives',
      },
    });
    expect(explainRes.status()).toBe(401);

    const compareRes = await page.request.post('/api/v1/advisory/compare-choices', {
      data: { alternativeId: 'transport-trip-chaining-no-idling' },
    });
    expect(compareRes.status()).toBe(401);

    const refreshRes = await page.request.post('/api/v1/advisory/refresh', { data: {} });
    expect(refreshRes.status()).toBe(401);

    const metricsRes = await page.request.get('/api/v1/advisory/metrics');
    expect(metricsRes.status()).toBe(401);
  });

  test('renders Personalized Daily Briefing, 6-part Impact Explanation, Compare My Choices, and passes WCAG 2.2 AA', async ({
    page,
  }) => {
    await setupPhase6E2ERoutes(page, { mode: 'gemini', freshness: 'fresh' });
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');

    const workspace = page.getByTestId('personalized-advisory-workspace');
    await expect(workspace).toBeVisible();
    await expect(workspace.getByTestId('advisory-origin-disclosure')).toContainText(
      /AI-generated explanation/i,
    );

    // Click "Why this recommendation?" on first priority action
    await workspace
      .getByRole('button', { name: /Why this recommendation\?/i })
      .first()
      .click();
    const explainResult = workspace.getByTestId('why-recommendation-result');
    await expect(explainResult).toBeVisible();
    await expect(explainResult).toContainText(/1\. Action/i);
    await expect(explainResult).toContainText(/6\. Limitations/i);
    await expect(explainResult).toContainText(/Open-Meteo Air Quality/i);

    // Run Compare My Choices
    await workspace.getByRole('button', { name: 'Compare my choices' }).click();
    const compareResult = workspace.getByTestId('compare-choices-result');
    await expect(compareResult).toBeVisible();
    await expect(compareResult).toContainText(/Bundled errands vs\. separate cold-start car runs/i);

    // Accessibility check across desktop & mobile viewports
    const accessibilityScan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibilityScan.violations).toEqual([]);
  });

  test('discloses deterministic fallback and unavailable telemetry cleanly inside advisory workspace', async ({
    page,
  }) => {
    await setupPhase6E2ERoutes(page, {
      mode: 'deterministic_fallback',
      freshness: 'unavailable',
    });
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');

    const workspace = page.getByTestId('personalized-advisory-workspace');
    await expect(workspace).toBeVisible();
    await expect(workspace.getByTestId('advisory-origin-disclosure')).toContainText(
      /Deterministic fallback explanation/i,
    );
    await expect(workspace.getByText(/Outdoor air quality data unavailable/i)).toBeVisible();
  });
});
