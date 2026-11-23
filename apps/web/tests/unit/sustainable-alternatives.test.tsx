import type {
  AlternativeComparisonView,
  AlternativesCompareQueryInput,
  AlternativesQueryInput,
  HouseholdLifestyleRecord,
  SustainableAlternativeItem,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SustainableAlternativesWorkspace } from '../../src/features/alternatives/SustainableAlternativesWorkspace.tsx';
import type { WebApiClient } from '../../src/lib/apiClient.ts';

async function runAxeAudit(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    },
  });
  expect(results.violations).toEqual([]);
}

const MOCK_PROFILE: HouseholdLifestyleRecord = {
  ownerUid: 'uid_alt_web',
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
  hasIndoorAirPurifier: false,
  heatingType: 'solid_fuel',
  lifestylePreferences: {
    preferredGuidanceFocus: 'balanced',
    reminderCadence: 'daily_smog_alerts',
  },
  onboardingCompleted: true,
};

const SAMPLE_ITEMS: readonly SustainableAlternativeItem[] = [
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
    suitabilityReason: 'Immediate zero-cost habit shift under your household’s direct control.',
    personalizationDrivers: ['Commute mode (gas vehicle)'],
    currentChoice: 'Separate cold-start car trips and stationary idling.',
    suggestedAlternative: 'Group errands into one planned loop and turn off ignition when parked.',
    whyPreferable: 'Cuts cold-start catalyst inefficiency and sidewalk exhaust plumes.',
    directAqVsBroaderNote: 'Directly cuts local tailpipe NO2, CO, and soot emissions.',
    ghgVsLocalPollutantNote:
      'Separates immediate sidewalk exhaust reduction from CO2 conservation.',
    tradeoffsAndLimitations: 'Requires weekly errand planning.',
    costAndAccessibilityNote: 'Zero cost.',
    infrastructureConditionality: null,
    qualitativeComparisonNote: 'Qualitatively cuts cold-start exhaust bursts.',
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
        exposureRiskNote: 'Curb delivery stops add local micro-emissions.',
        emissionProfileNote: 'Shifts exhaust to commercial vans.',
        sustainabilityNote: 'Higher packaging waste.',
      },
    ],
    defaultBaselineId: 'separate_cold_trips',
    evidenceReference: {
      sourceName: 'US EPA — Transportation, Air Pollution, and Climate Change',
      sourceUrl: 'https://www.epa.gov/transportation-air-pollution-and-climate-change',
      relevantFinding: 'Combining trips reduces cold-start exhaust.',
      versionOrDate: 'EPA Guidance',
      limitations: 'Real-world effect depends on distance and traffic.',
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
    suitabilityReason: 'High outdoor PM2.5 increases inhaled pollutant dose during exertion.',
    personalizationDrivers: ['US AQI 182 (Unhealthy)'],
    currentChoice: 'Walking or cycling beside congested roads during high pollution.',
    suggestedAlternative: 'Defer optional cycling/walking until cleaner air windows return.',
    whyPreferable: 'Protects respiratory inhalation dose during elevated outdoor pollution.',
    directAqVsBroaderNote: 'Protects personal exposure without claiming ambient air improvement.',
    ghgVsLocalPollutantNote: 'Separates zero tailpipe emissions from personal inhalation risk.',
    tradeoffsAndLimitations: 'Unsuitable in heavy smog or unsafe streets.',
    costAndAccessibilityNote: 'Zero cost.',
    infrastructureConditionality: 'Requires safe sidewalks or separated bike lanes.',
    qualitativeComparisonNote: 'Balances personal inhalation risk against tailpipe avoidance.',
    baselineOptions: [
      {
        id: 'arterial_cycling_high_aqi',
        label: 'High-exertion arterial cycling during poor AQI',
        summary: 'Cycling beside idling traffic during high PM2.5.',
        exposureRiskNote: 'Higher breathing rate elevates inhaled dose.',
        emissionProfileNote: 'Zero tailpipe emissions.',
        sustainabilityNote: 'Low material footprint.',
      },
    ],
    defaultBaselineId: 'arterial_cycling_high_aqi',
    evidenceReference: {
      sourceName: 'EEA — Transport and Air Quality',
      sourceUrl: 'https://www.eea.europa.eu/en/topics/in-depth/transport-and-mobility',
      relevantFinding: 'Higher exertion increases dose during poor ambient air quality.',
      versionOrDate: 'EEA Briefing',
      limitations: 'Varies by street layout and pollutant concentration.',
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
    suitabilityReason: 'Explicitly separated from direct short-term AQI fixes.',
    personalizationDrivers: ['Household size (4 members)'],
    currentChoice: 'Replacing minor-fault items and buying single-use packaging.',
    suggestedAlternative: 'Repair durable items and reuse containers.',
    whyPreferable: 'Reduces landfill burden and upstream manufacturing waste.',
    directAqVsBroaderNote: 'Does NOT immediately reduce neighborhood PM2.5 or NO2 today.',
    ghgVsLocalPollutantNote: 'Upstream CO2e savings tracked separately from local air pollutants.',
    tradeoffsAndLimitations: 'Repair spare parts may vary.',
    costAndAccessibilityNote: 'Zero to low cost.',
    infrastructureConditionality: 'Local repair options vary by neighborhood.',
    qualitativeComparisonNote: 'Qualitatively cuts waste without invented CO2 numbers.',
    baselineOptions: [
      {
        id: 'disposable_replace_first',
        label: 'Single-use packaging & replace-on-fault',
        summary: 'Discarding repairable goods prematurely.',
        exposureRiskNote: 'Neutral immediate exposure.',
        emissionProfileNote: 'Minimal direct street exhaust change.',
        sustainabilityNote: 'Higher landfill burden.',
      },
    ],
    defaultBaselineId: 'disposable_replace_first',
    evidenceReference: {
      sourceName: 'US EPA — Sustainable Materials Management',
      sourceUrl: 'https://www.epa.gov/smm/sustainable-materials-management-non-hazardous-materials',
      relevantFinding: 'Repair and reuse lower landfill waste and upstream extraction.',
      versionOrDate: 'EPA Overview',
      limitations: 'Does not replace direct neighborhood air pollution controls.',
    },
  },
];

function createComparison(
  item: SustainableAlternativeItem,
  baselineId?: string,
): AlternativeComparisonView {
  const baseline =
    item.baselineOptions.find((option) => option.id === baselineId) ?? item.baselineOptions[0]!;
  return {
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
  };
}

function createMockAlternativesResponse(options?: {
  readonly query?: AlternativesQueryInput;
  readonly freshness?: 'fresh' | 'stale' | 'unavailable';
}): SustainableAlternativesResponse {
  const freshness = options?.freshness ?? 'fresh';
  const query = options?.query ?? {};
  const filtered = SAMPLE_ITEMS.filter((item) => {
    if (query.category && item.category !== query.category) return false;
    if (query.affordability && item.affordabilityTier !== query.affordability) return false;
    if (query.relevance && item.relevanceScope !== query.relevance) return false;
    if (query.impactType && item.impactClassification !== query.impactType) return false;
    if (query.practicality && item.suitabilityStatus !== query.practicality) return false;
    return true;
  });

  return {
    advisoryId: 'uid_alt_web::mock',
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
        'Tailored alternatives separating local emissions, personal exposure, and sustainability.',
      totalCatalogEvaluated: SAMPLE_ITEMS.length,
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
      outdoorConditionSummary: 'US AQI 182 (Unhealthy)',
      impactDistinctionLegend: [
        {
          classification: 'local_emissions',
          label: 'Reduces local emissions',
          summary: 'Lowers tailpipe and domestic exhaust.',
          localPollutantRelevance: 'Targets PM2.5, NO2, and CO.',
        },
        {
          classification: 'personal_exposure',
          label: 'Reduces personal exposure',
          summary: 'Lowers household inhalation dose.',
          localPollutantRelevance: 'Protects health during high AQI.',
        },
        {
          classification: 'both_exposure_and_emissions',
          label: 'Exposure & local emissions co-benefit',
          summary: 'Lowers both inhalation and emissions.',
          localPollutantRelevance: 'Best combined option.',
        },
        {
          classification: 'broader_sustainability',
          label: 'Broader environmental sustainability',
          summary: 'Conserves climate & material resources.',
          localPollutantRelevance: 'Does not guarantee immediate local AQI change.',
        },
      ],
      activeTransportAqiNote:
        freshness === 'unavailable'
          ? 'Outdoor AQI telemetry is unavailable; active travel stays conditional.'
          : 'High pollution alert: walking or cycling outdoors is NOT advised right now.',
    },
    appliedFilters: {
      category: query.category ?? null,
      affordability: query.affordability ?? null,
      relevance: query.relevance ?? null,
      impactType: query.impactType ?? null,
      practicality: query.practicality ?? null,
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
        meaning: 'Elevated PM2.5.',
        precautionSummary: 'Avoid outdoor exertion.',
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
        precautionSummary: 'Limit outdoor exercise.',
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
        cacheAgeSeconds: freshness === 'stale' ? 2400 : 12,
        fallbackActive: freshness !== 'fresh',
        fallbackReason: freshness === 'stale' ? 'Cached reading in use.' : null,
        methodologySummary: 'Independent scales.',
      },
    },
    alternatives: filtered,
    featuredComparison: filtered[0] ? createComparison(filtered[0]) : null,
    provenanceAndDisclosures: {
      dataSources: ['Household profile', 'Open-Meteo'],
      methodologicalPrinciples: [
        'Local pollutants are strictly separated from climate/sustainability benefits.',
      ],
      limitationsSummary: 'Qualitative comparisons only.',
    },
  };
}

function buildMockClient(overrides?: Partial<WebApiClient>): WebApiClient {
  return {
    getHealth: vi.fn(),
    getAuthSession: vi.fn(),
    verifyToken: vi.fn(),
    requestPasswordResetAudit: vi.fn(),
    getHouseholdProfile: vi.fn(),
    saveHouseholdProfile: vi.fn(),
    validateHouseholdProfile: vi.fn(),
    getAirQualityCurrent: vi.fn(),
    getAirQualityForecast: vi.fn(),
    getAirQualityPollutants: vi.fn(),
    getAirQualityGuidance: vi.fn(),
    getAirQualityHealth: vi.fn(),
    updateAirQualityLocation: vi.fn(),
    getDailyRoutines: vi.fn(),
    refreshDailyRoutines: vi.fn(),
    getIndoorAirGuidance: vi.fn(),
    refreshIndoorAirGuidance: vi.fn(),
    getSustainableAlternatives: vi.fn(async (query?: AlternativesQueryInput) =>
      createMockAlternativesResponse(query !== undefined ? { query } : undefined),
    ),
    compareSustainableAlternative: vi.fn(async (query: AlternativesCompareQueryInput) => {
      const found =
        SAMPLE_ITEMS.find((item) => item.id === query.alternativeId) ?? SAMPLE_ITEMS[0]!;
      return createComparison(found, query.currentOption);
    }),
    refreshSustainableAlternatives: vi.fn(async () => createMockAlternativesResponse()),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('SustainableAlternativesWorkspace Component', () => {
  it('renders 4-way impact distinction legend, tailored cards, comparison panel, and passes WCAG 2.2 AA', async () => {
    const apiClient = buildMockClient();
    const { container } = render(
      <SustainableAlternativesWorkspace profile={MOCK_PROFILE} apiClient={apiClient} />,
    );

    expect(await screen.findByTestId('sustainable-alternatives-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('impact-legend-local_emissions')).toBeInTheDocument();
    expect(screen.getByTestId('impact-legend-personal_exposure')).toBeInTheDocument();
    expect(screen.getByTestId('impact-legend-both_exposure_and_emissions')).toBeInTheDocument();
    expect(screen.getByTestId('impact-legend-broader_sustainability')).toBeInTheDocument();

    expect(
      screen.getByTestId('alternative-card-transport-active-travel-aqi-aware'),
    ).toHaveTextContent(/Not advised outdoors now/i);
    expect(screen.getByTestId('alternative-comparison-panel')).toHaveTextContent(
      /Combine household errands/i,
    );

    await runAxeAudit(container);
  });

  it('filters alternatives by category and allows resetting empty filter combinations', async () => {
    const apiClient = buildMockClient();
    render(<SustainableAlternativesWorkspace profile={MOCK_PROFILE} apiClient={apiClient} />);

    await screen.findByTestId('sustainable-alternatives-workspace');

    fireEvent.click(screen.getByRole('button', { name: 'Consumption & Waste' }));
    await waitFor(() => {
      expect(apiClient.getSustainableAlternatives).toHaveBeenCalledWith({
        category: 'consumption_waste',
      });
    });

    expect(
      screen.getByTestId('alternative-card-consumption-reuse-repair-packaging'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Energy & Heating' }));
    expect(
      await screen.findByText(/No sustainable alternatives match your current filter combination/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Reset all filters/i })[0]!);
    await waitFor(() => {
      expect(
        screen.getByTestId('alternative-card-transport-trip-chaining-no-idling'),
      ).toBeInTheDocument();
    });
  });

  it('compares a selected alternative side-by-side and switches current habit baseline', async () => {
    const apiClient = buildMockClient();
    render(<SustainableAlternativesWorkspace profile={MOCK_PROFILE} apiClient={apiClient} />);

    await screen.findByTestId('sustainable-alternatives-workspace');

    const compareButtons = screen.getAllByRole('button', { name: 'Compare side-by-side' });
    fireEvent.click(compareButtons[0]!);

    await waitFor(() => {
      expect(apiClient.compareSustainableAlternative).toHaveBeenCalledWith({
        alternativeId: 'transport-active-travel-aqi-aware',
      });
    });

    // Switch back to the first item's comparison panel cleanly
    const firstCard = screen.getByTestId('alternative-card-transport-trip-chaining-no-idling');
    fireEvent.click(within(firstCard).getByRole('button', { name: /Compare side-by-side/i }));
    await waitFor(() => {
      expect(screen.getByTestId('alternative-comparison-panel')).toHaveTextContent(
        /Separate cold-start trips & idling/i,
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Frequent unbundled small deliveries/i }));
    await waitFor(() => {
      expect(apiClient.compareSustainableAlternative).toHaveBeenCalledWith({
        alternativeId: 'transport-trip-chaining-no-idling',
        currentOption: 'delivery_split_orders',
      });
    });
  });

  it('recovers cleanly from fetch errors via retry CTA', async () => {
    const apiClient = buildMockClient({
      getSustainableAlternatives: vi.fn(async () => {
        throw new Error('Alternatives service offline');
      }),
      refreshSustainableAlternatives: vi.fn(async () => createMockAlternativesResponse()),
    });

    render(<SustainableAlternativesWorkspace profile={MOCK_PROFILE} apiClient={apiClient} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Alternatives service offline/i);

    fireEvent.click(screen.getByRole('button', { name: /Retry alternatives/i }));
    await waitFor(() => {
      expect(screen.getByTestId('sustainable-alternatives-workspace')).toBeInTheDocument();
    });
  });
});
