import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function buildApiEnvelope<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      requestId: 'e2e-alt-req-1',
      timestamp: '2026-11-23T09:00:00.000Z',
    },
  };
}

const E2E_ITEMS = [
  {
    id: 'transport-trip-chaining-no-idling',
    category: 'transportation',
    categoryLabel: 'Transportation',
    title: 'Combine household errands and eliminate unnecessary vehicle idling',
    currentHabitMatched: 'Saved commute (gas vehicle)',
    impactClassification: 'local_emissions',
    impactClassificationLabel: 'Reduces local emissions',
    affordabilityTier: 'zero_cost',
    affordabilityLabel: 'No added cost / habit shift',
    relevanceScope: 'outdoor',
    relevanceLabel: 'Outdoor setting',
    suitabilityStatus: 'recommended',
    suitabilityLabel: 'Suitable for your household now',
    suitabilityReason: 'Immediate zero-cost habit shift under your household control.',
    personalizationDrivers: ['Commute mode (gas vehicle)'],
    currentChoice: 'Separate cold-start car trips and stationary idling.',
    suggestedAlternative: 'Group errands into one planned loop and turn off ignition when parked.',
    whyPreferable: 'Cuts cold-start exhaust bursts near sidewalks and schools.',
    directAqVsBroaderNote: 'Directly reduces local tailpipe NO2, CO, and soot emissions.',
    ghgVsLocalPollutantNote: 'Separates immediate sidewalk exhaust cut from fuel CO2 savings.',
    tradeoffsAndLimitations: 'Requires weekly errand planning.',
    costAndAccessibilityNote: 'Zero cost.',
    infrastructureConditionality: null,
    qualitativeComparisonNote: 'Qualitatively reduces cold-start exhaust emissions.',
    baselineOptions: [
      {
        id: 'separate_cold_trips',
        label: 'Separate cold-start trips & idling',
        summary: 'Running separate short trips daily and idling while parked.',
        exposureRiskNote: 'Concentrates exhaust near entrances.',
        emissionProfileNote: 'Higher cold-start NOx and CO.',
        sustainabilityNote: 'Higher fuel burn.',
      },
      {
        id: 'delivery_split_orders',
        label: 'Frequent unbundled small deliveries',
        summary: 'Replacing trips with separate courier vans.',
        exposureRiskNote: 'Curb delivery stops add local exhaust.',
        emissionProfileNote: 'Shifts exhaust to delivery vans.',
        sustainabilityNote: 'Higher packaging waste.',
      },
    ],
    defaultBaselineId: 'separate_cold_trips',
    evidenceReference: {
      sourceName: 'US EPA — Transportation, Air Pollution, and Climate Change',
      sourceUrl: 'https://www.epa.gov/transportation-air-pollution-and-climate-change',
      relevantFinding: 'Combining trips reduces cold-start exhaust.',
      versionOrDate: 'EPA Guidance',
      limitations: 'Actual benefit varies with trip distance and traffic.',
    },
  },
  {
    id: 'transport-active-travel-aqi-aware',
    category: 'transportation',
    categoryLabel: 'Transportation',
    title: 'Walk or cycle short errands only when air quality and street safety permit',
    currentHabitMatched: 'Short motorized trips',
    impactClassification: 'personal_exposure',
    impactClassificationLabel: 'Reduces personal exposure',
    affordabilityTier: 'zero_cost',
    affordabilityLabel: 'No added cost / habit shift',
    relevanceScope: 'outdoor',
    relevanceLabel: 'Outdoor setting',
    suitabilityStatus: 'not_advised_now',
    suitabilityLabel: 'Not advised outdoors right now',
    suitabilityReason: 'High outdoor PM2.5 increases inhaled pollutant dose during brisk exertion.',
    personalizationDrivers: ['US AQI 182 (Unhealthy)'],
    currentChoice: 'Walking or cycling beside congested roads during high pollution.',
    suggestedAlternative: 'Defer optional outdoor cycling until cleaner air windows return.',
    whyPreferable: 'Protects personal respiratory exposure during smog episodes.',
    directAqVsBroaderNote: 'Protects personal exposure without reducing ambient pollution.',
    ghgVsLocalPollutantNote: 'Balances zero tailpipe emissions with inhalation risk.',
    tradeoffsAndLimitations: 'Unsuitable in heavy smog or without safe bike lanes.',
    costAndAccessibilityNote: 'Zero cost.',
    infrastructureConditionality: 'Sidewalks and protected bike lanes vary by street.',
    qualitativeComparisonNote: 'Balances personal exposure and zero exhaust.',
    baselineOptions: [
      {
        id: 'arterial_cycling_high_aqi',
        label: 'High-exertion arterial cycling during poor AQI',
        summary: 'Cycling beside idling traffic during elevated PM2.5.',
        exposureRiskNote: 'Higher breathing rate elevates inhaled dose.',
        emissionProfileNote: 'Zero tailpipe emissions.',
        sustainabilityNote: 'Low material footprint.',
      },
    ],
    defaultBaselineId: 'arterial_cycling_high_aqi',
    evidenceReference: {
      sourceName: 'EEA — Transport and Air Quality',
      sourceUrl: 'https://www.eea.europa.eu/en/topics/in-depth/transport-and-mobility',
      relevantFinding: 'Higher exertion increases inhaled dose during smog episodes.',
      versionOrDate: 'EEA Briefing',
      limitations: 'Varies by street layout and ambient concentration.',
    },
  },
  {
    id: 'consumption-reuse-repair-packaging',
    category: 'consumption_waste',
    categoryLabel: 'Consumption & Waste Habits',
    title: 'Prioritize repair, durable reuse, and lower-packaging everyday purchases',
    currentHabitMatched: 'Everyday goods & packaging',
    impactClassification: 'broader_sustainability',
    impactClassificationLabel: 'Broader sustainability benefit (indirect local AQ)',
    affordabilityTier: 'zero_cost',
    affordabilityLabel: 'No added cost / habit shift',
    relevanceScope: 'both',
    relevanceLabel: 'Indoor & outdoor relevance',
    suitabilityStatus: 'recommended',
    suitabilityLabel: 'Suitable for your household now',
    suitabilityReason: 'Long-term circular sustainability habit separated from immediate AQI.',
    personalizationDrivers: ['Household size (4 members)'],
    currentChoice: 'Replacing minor-fault goods and buying single-use packaging.',
    suggestedAlternative: 'Repair durable items and reuse containers.',
    whyPreferable: 'Reduces landfill waste and upstream manufacturing demand.',
    directAqVsBroaderNote: 'Does NOT immediately lower neighborhood PM2.5 or NO2 today.',
    ghgVsLocalPollutantNote: 'Upstream CO2e tracked separately from direct local air quality.',
    tradeoffsAndLimitations: 'Spare parts may vary.',
    costAndAccessibilityNote: 'Zero to low cost.',
    infrastructureConditionality: 'Repair cafe access varies locally.',
    qualitativeComparisonNote: 'Qualitatively cuts waste without invented numerical claims.',
    baselineOptions: [
      {
        id: 'disposable_replace_first',
        label: 'Single-use packaging & replace-on-fault',
        summary: 'Discarding repairable items prematurely.',
        exposureRiskNote: 'Neutral immediate exposure.',
        emissionProfileNote: 'Minimal immediate street exhaust effect.',
        sustainabilityNote: 'Higher landfill waste.',
      },
    ],
    defaultBaselineId: 'disposable_replace_first',
    evidenceReference: {
      sourceName: 'US EPA — Sustainable Materials Management',
      sourceUrl: 'https://www.epa.gov/smm/sustainable-materials-management-non-hazardous-materials',
      relevantFinding: 'Repair and reuse cut landfill burden.',
      versionOrDate: 'EPA Overview',
      limitations: 'Does not replace direct neighborhood emission reductions.',
    },
  },
];

function createAlternativesPayload(options?: {
  readonly category?: string | null;
  readonly freshness?: 'fresh' | 'unavailable';
}) {
  const freshness = options?.freshness ?? 'fresh';
  const category = options?.category ?? null;
  const filtered = E2E_ITEMS.filter((item) => !category || item.category === category);
  const first = filtered[0];

  return {
    advisoryId: `uid_e2e_family::${category ?? 'all'}::${freshness}`,
    generatedAt: '2026-11-23T09:00:00Z',
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
      headline: 'Sustainable Alternatives Advisor (Krakow)',
      summary:
        'Practical, affordable alternatives tailored to your commute, home heating, and current air quality.',
      totalCatalogEvaluated: E2E_ITEMS.length,
      matchedAlternativesCount: filtered.length,
      countsByCategory: {
        transportation: filtered.filter((i) => i.category === 'transportation').length,
        household_energy_heating: 0,
        everyday_activities: 0,
        consumption_waste: filtered.filter((i) => i.category === 'consumption_waste').length,
      },
      countsByImpact: {
        local_emissions: filtered.filter((i) => i.impactClassification === 'local_emissions')
          .length,
        personal_exposure: filtered.filter((i) => i.impactClassification === 'personal_exposure')
          .length,
        both_exposure_and_emissions: 0,
        broader_sustainability: filtered.filter(
          (i) => i.impactClassification === 'broader_sustainability',
        ).length,
      },
      householdSummary: {
        householdSize: 4,
        householdComposition: ['adults', 'young_children'],
        primaryCommuteMode: 'gas_vehicle',
        heatingType: 'solid_fuel',
        ventilationContext: 'natural_windows',
        primaryZoneType: 'valley_basin',
      },
      outdoorConditionSummary:
        freshness === 'unavailable' ? 'Unavailable.' : 'US AQI 182 (Unhealthy).',
      impactDistinctionLegend: [
        {
          classification: 'local_emissions',
          label: 'Reduces local emissions',
          summary: 'Lowers tailpipe exhaust and combustion smoke.',
          localPollutantRelevance: 'Directly targets PM2.5, NO2, and CO.',
        },
        {
          classification: 'personal_exposure',
          label: 'Reduces personal exposure',
          summary: 'Lowers household inhalation dose.',
          localPollutantRelevance: 'Shifts timing or activity away from elevated pollution.',
        },
        {
          classification: 'both_exposure_and_emissions',
          label: 'Exposure & local emissions co-benefit',
          summary: 'Contributes to both exposure and emissions reduction.',
          localPollutantRelevance: 'Strongest combined clean-air benefit.',
        },
        {
          classification: 'broader_sustainability',
          label: 'Broader environmental sustainability',
          summary: 'Conserves materials and climate resources.',
          localPollutantRelevance: 'Distinct from immediate neighborhood air quality.',
        },
      ],
      activeTransportAqiNote:
        freshness === 'unavailable'
          ? 'Outdoor AQI telemetry is unavailable in Krakow; active travel is marked conditional.'
          : 'High pollution alert: walking or cycling outdoors is NOT universally advised right now.',
    },
    appliedFilters: {
      category,
      affordability: null,
      relevance: null,
      impactType: null,
      practicality: null,
    },
    airQualityContext: {
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
        meaning: 'High PM2.5.',
        precautionSummary: 'Limit outdoor exertion.',
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
        meaning: 'Poor AQI.',
        precautionSummary: 'Limit exertion.',
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
        providerName: 'Open-Meteo Air Quality',
        dataNature: freshness === 'unavailable' ? 'unavailable' : 'model_forecast',
        dataNatureDisclosure: 'Model forecast.',
        attribution: 'Open-Meteo CC BY 4.0',
        freshnessStatus: freshness,
        availabilityStatus: freshness === 'unavailable' ? 'unavailable' : 'available',
        observationTimestamp: freshness === 'unavailable' ? null : '2026-11-23T09:00:00Z',
        fetchedAt: '2026-11-23T09:01:00Z',
        cacheAgeSeconds: 12,
        fallbackActive: freshness !== 'fresh',
        fallbackReason: null,
        methodologySummary: 'Independent scales.',
      },
    },
    alternatives: filtered,
    featuredComparison: first
      ? {
          alternativeId: first.id,
          alternativeTitle: first.title,
          category: first.category,
          impactClassification: first.impactClassification,
          impactClassificationLabel: first.impactClassificationLabel,
          affordabilityTier: first.affordabilityTier,
          affordabilityLabel: first.affordabilityLabel,
          relevanceScope: first.relevanceScope,
          suitabilityStatus: first.suitabilityStatus,
          selectedBaselineId: first.baselineOptions[0]!.id,
          selectedBaselineLabel: first.baselineOptions[0]!.label,
          availableBaselines: first.baselineOptions,
          currentChoiceSummary: first.baselineOptions[0]!.summary,
          suggestedAlternativeSummary: first.suggestedAlternative,
          whyPreferable: first.whyPreferable,
          directAirQualityAndEmissionsEffect: first.directAqVsBroaderNote,
          personalExposureEffect: first.baselineOptions[0]!.exposureRiskNote,
          broaderSustainabilityEffect: first.qualitativeComparisonNote,
          ghgVsLocalPollutantDistinction: first.ghgVsLocalPollutantNote,
          costAndAccessibility: first.costAndAccessibilityNote,
          tradeoffsAndLimitations: first.tradeoffsAndLimitations,
          infrastructureConditionality: first.infrastructureConditionality,
          evidenceReference: first.evidenceReference,
        }
      : null,
    provenanceAndDisclosures: {
      dataSources: ['Household profile', 'Open-Meteo'],
      methodologicalPrinciples: [
        'Local pollutants are strictly separated from climate/sustainability benefits.',
      ],
      limitationsSummary: 'Qualitative comparisons only.',
    },
  };
}

async function setupAlternativesE2ERoutes(
  page: Page,
  options?: { readonly freshness?: 'fresh' | 'unavailable' },
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

  const altPayload = createAlternativesPayload({ freshness });

  await page.route('**/api/v1/air-quality/current*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          location: altPayload.location,
          aqi: {
            usAqi: altPayload.airQualityContext.usAqi,
            europeanAqi: altPayload.airQualityContext.europeanAqi,
            dominantPollutant: altPayload.airQualityContext.dominantPollutant,
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
          transparency: altPayload.airQualityContext.transparency,
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
          location: altPayload.location,
          horizonHours: 24,
          hourly: [],
          transparency: altPayload.airQualityContext.transparency,
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
          location: altPayload.location,
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
          airQualityContext: {
            usAqi: altPayload.airQualityContext.usAqi,
            europeanAqi: altPayload.airQualityContext.europeanAqi,
            dominantPollutant: altPayload.airQualityContext.dominantPollutant,
            pollutants: [],
            transparency: altPayload.airQualityContext.transparency,
          },
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
          location: altPayload.location,
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
          airQualityContext: {
            usAqi: altPayload.airQualityContext.usAqi,
            europeanAqi: altPayload.airQualityContext.europeanAqi,
            dominantPollutant: altPayload.airQualityContext.dominantPollutant,
            pollutants: [],
            transparency: altPayload.airQualityContext.transparency,
          },
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

  await page.route('**/api/v1/alternatives/recommendations*', async (route) => {
    const url = new URL(route.request().url());
    const category = url.searchParams.get('category');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildApiEnvelope(createAlternativesPayload({ category, freshness }))),
    });
  });

  await page.route('**/api/v1/alternatives/compare*', async (route) => {
    const url = new URL(route.request().url());
    const alternativeId = url.searchParams.get('alternativeId') ?? E2E_ITEMS[0]!.id;
    const currentOption = url.searchParams.get('currentOption');
    const item = E2E_ITEMS.find((entry) => entry.id === alternativeId) ?? E2E_ITEMS[0]!;
    const baseline =
      item.baselineOptions.find((entry) => entry.id === currentOption) ?? item.baselineOptions[0]!;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          alternativeId: item.id,
          alternativeTitle: item.title,
          category: item.category,
          impactClassification: item.impactClassification,
          impactClassificationLabel: item.impactClassificationLabel,
          affordabilityTier: item.affordabilityTier,
          affordabilityLabel: item.affordabilityLabel,
          relevanceScope: item.relevanceScope,
          suitabilityStatus: item.suitabilityStatus,
          selectedBaselineId: baseline.id,
          selectedBaselineLabel: baseline.label,
          availableBaselines: item.baselineOptions,
          currentChoiceSummary: baseline.summary,
          suggestedAlternativeSummary: item.suggestedAlternative,
          whyPreferable: item.whyPreferable,
          directAirQualityAndEmissionsEffect: `${item.directAqVsBroaderNote} Relative to "${baseline.label}": ${baseline.emissionProfileNote}`,
          personalExposureEffect: baseline.exposureRiskNote,
          broaderSustainabilityEffect: item.qualitativeComparisonNote,
          ghgVsLocalPollutantDistinction: item.ghgVsLocalPollutantNote,
          costAndAccessibility: item.costAndAccessibilityNote,
          tradeoffsAndLimitations: item.tradeoffsAndLimitations,
          infrastructureConditionality: item.infrastructureConditionality,
          evidenceReference: item.evidenceReference,
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
          location: altPayload.location,
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
            freshnessStatus: 'fresh',
            availabilityStatus: 'available',
            observationTimestamp: '2026-11-23T09:00:00Z',
            usAqiValue: 182,
            usAqiCategory: 'Unhealthy',
            europeanAqiValue: 88,
            europeanAqiCategory: 'Poor',
            dominantPollutantCode: 'pm2_5',
            dominantPollutantLabel: 'PM2.5',
            isHighOrWorse: true,
            isElevatedOrWorse: true,
            isCyclingNotAdvised: true,
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

test.describe('Phase 5 Sustainable Alternatives Advisor (E2E & WCAG 2.2 AA)', () => {
  test('enforces unauthenticated protection on alternatives endpoints', async ({ page }) => {
    const recRes = await page.request.get('/api/v1/alternatives/recommendations');
    expect(recRes.status()).toBe(401);

    const compareRes = await page.request.get(
      '/api/v1/alternatives/compare?alternativeId=transport-public-transit',
    );
    expect(compareRes.status()).toBe(401);

    const refreshRes = await page.request.post('/api/v1/alternatives/refresh', { data: {} });
    expect(refreshRes.status()).toBe(401);
  });

  test('renders sustainable alternatives, 4-way distinction, interactive comparison, filtering, and passes WCAG 2.2 AA', async ({
    page,
  }) => {
    await setupAlternativesE2ERoutes(page, { freshness: 'fresh' });
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');

    await expect(page.getByTestId('sustainable-alternatives-workspace')).toBeVisible();
    await expect(page.getByTestId('impact-legend-local_emissions')).toBeVisible();
    await expect(page.getByTestId('impact-legend-broader_sustainability')).toBeVisible();

    // High-AQI active transport warning is visible
    await expect(
      page.getByTestId('alternative-card-transport-active-travel-aqi-aware'),
    ).toContainText(/Not advised outdoors now/i);

    // Switch side-by-side comparison baseline
    await page.getByRole('button', { name: 'Frequent unbundled small deliveries' }).click();
    await expect(page.getByTestId('alternative-comparison-panel')).toContainText(
      /Shifts exhaust to delivery vans/i,
    );

    // Filter to Consumption & Waste
    await page.getByRole('button', { name: 'Consumption & Waste' }).click();
    await expect(
      page.getByTestId('alternative-card-consumption-reuse-repair-packaging'),
    ).toBeVisible();
    await expect(
      page.getByTestId('alternative-card-transport-trip-chaining-no-idling'),
    ).toHaveCount(0);

    // Accessibility check
    const accessibilityScan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibilityScan.violations).toEqual([]);
  });

  test('discloses unavailable outdoor telemetry honestly without fabricating AQI suitability', async ({
    page,
  }) => {
    await setupAlternativesE2ERoutes(page, { freshness: 'unavailable' });
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');

    await expect(page.getByTestId('sustainable-alternatives-workspace')).toBeVisible();
    await expect(
      page.getByText(/Live outdoor AQI unavailable — active travel marked conditional/i),
    ).toBeVisible();
  });
});
