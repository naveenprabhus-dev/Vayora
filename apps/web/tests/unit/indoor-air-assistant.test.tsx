import type {
  HouseholdLifestyleRecord,
  IndoorAirGuidanceResponse,
  IndoorGuidanceQueryInput,
  IndoorScenarioId,
} from '@uaqa/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndoorAirAssistantWorkspace } from '../../src/features/indoor/IndoorAirAssistantWorkspace.tsx';
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
  ownerUid: 'uid_test_family',
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
    preferredGuidanceFocus: 'indoor_air',
    reminderCadence: 'daily_smog_alerts',
  },
  onboardingCompleted: true,
};

function createMockIndoorResponse(options?: {
  readonly scenario?: IndoorScenarioId;
  readonly hasPurifier?: boolean;
  readonly ventilationState?: IndoorAirGuidanceResponse['ventilationGuidance']['state'];
  readonly freshness?: 'fresh' | 'stale' | 'unavailable';
}): IndoorAirGuidanceResponse {
  const scenario = options?.scenario ?? 'baseline';
  const hasPurifier = options?.hasPurifier ?? true;
  const freshness = options?.freshness ?? 'fresh';
  const ventilationState =
    options?.ventilationState ??
    (freshness === 'unavailable' ? 'insufficient_data' : 'shorter_timed_ventilation');
  const isSimulation = scenario !== 'baseline';
  const simulatedPurifier = !hasPurifier && scenario === 'operating_purifier';

  return {
    guidanceId: `uid_test_family::${scenario}::${freshness}`,
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
      hasIndoorAirPurifier: hasPurifier,
      heatingType: 'solid_fuel',
      primaryZoneType: 'valley_basin',
      outdoorConditionSummary:
        freshness === 'unavailable'
          ? 'Live outdoor telemetry is unavailable.'
          : 'Moderate outdoor particulate levels (PM2.5 22.8 µg/m³).',
      sensorStatus: {
        sensorConnected: false,
        disclosureStatement:
          'Indoor air quality is not being measured. These recommendations are based on your household settings, available outdoor air-quality information and general guidance.',
        evidenceDistinctions: [
          {
            category: 'measured_indoor',
            label: 'Measured indoor air quality',
            statusLabel: 'Not measured (no indoor sensors connected)',
            description:
              'No indoor PM2.5, PM10, CO2, CO, or VOC sensor readings exist. VAYORA never fabricates indoor numbers.',
          },
          {
            category: 'outdoor_air_quality',
            label: 'Outdoor air-quality information',
            statusLabel:
              freshness === 'unavailable'
                ? 'Unavailable'
                : freshness === 'stale'
                  ? 'Stale cached model data'
                  : 'Fresh Open-Meteo model forecast',
            description: 'Open-Meteo outdoor model data.',
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
            description: 'Source-control steps and chemical safety boundaries.',
          },
        ],
      },
    },
    airQualityContext: {
      usAqi: {
        scale: 'us_aqi',
        scaleLabel: 'US AQI (EPA)',
        authorityLabel: 'U.S. EPA 0–500 Scale',
        value: freshness === 'unavailable' ? null : 74,
        status: freshness === 'unavailable' ? 'unavailable' : 'available',
        category: freshness === 'unavailable' ? 'Unavailable' : 'Moderate',
        pollutionLevel: freshness === 'unavailable' ? 'unavailable' : 'moderate',
        pollutionLevelLabel:
          freshness === 'unavailable' ? 'Unavailable' : 'Moderate pollution level',
        severityToken: freshness === 'unavailable' ? 'unavailable' : 'moderate',
        meaning: 'Outdoor particulate accumulation.',
        precautionSummary: 'Prefer brief airing outside traffic peaks.',
        methodologyNote: 'US AQI.',
      },
      europeanAqi: {
        scale: 'european_aqi',
        scaleLabel: 'European AQI (EEA)',
        authorityLabel: 'EEA 0–100+ Index',
        value: freshness === 'unavailable' ? null : 48,
        status: freshness === 'unavailable' ? 'unavailable' : 'available',
        category: freshness === 'unavailable' ? 'Unavailable' : 'Moderate',
        pollutionLevel: freshness === 'unavailable' ? 'unavailable' : 'moderate',
        pollutionLevelLabel:
          freshness === 'unavailable' ? 'Unavailable' : 'Moderate pollution level',
        severityToken: freshness === 'unavailable' ? 'unavailable' : 'moderate',
        meaning: 'Moderate European AQI.',
        precautionSummary: 'Time brief ventilation.',
        methodologyNote: 'EEA.',
      },
      dominantPollutant: {
        status: freshness === 'unavailable' ? 'unavailable' : 'available',
        code: freshness === 'unavailable' ? null : 'pm2_5',
        abbreviation: freshness === 'unavailable' ? null : 'PM2.5',
        fullName: freshness === 'unavailable' ? null : 'Fine Particulate Matter',
        basis: freshness === 'unavailable' ? 'unavailable' : 'provider_sub_index',
        estimatedSubIndex: freshness === 'unavailable' ? null : 74,
        explanation: 'Fine PM2.5 leads.',
      },
      pollutants: [],
      transparency: {
        providerId: 'open-meteo',
        providerName: 'Open-Meteo Air Quality',
        dataNature: freshness === 'unavailable' ? 'unavailable' : 'model_forecast',
        dataNatureDisclosure: 'Model forecast.',
        attribution: 'Data provided by Open-Meteo.com (CC BY 4.0)',
        freshnessStatus: freshness,
        availabilityStatus: freshness === 'unavailable' ? 'unavailable' : 'available',
        observationTimestamp: freshness === 'unavailable' ? null : '2026-11-22T12:00:00Z',
        fetchedAt: '2026-11-22T12:02:00Z',
        cacheAgeSeconds: freshness === 'stale' ? 2400 : 12,
        fallbackActive: freshness !== 'fresh',
        fallbackReason: freshness === 'stale' ? 'Using cached telemetry.' : null,
        methodologySummary: 'Independent scales.',
      },
    },
    scenarioContext: {
      selectedScenario: scenario,
      isSimulation,
      simulationLabel: isSimulation
        ? 'Illustrative scenario simulation — not an indoor sensor measurement or permanent profile change.'
        : 'Saved household baseline (no active simulation)',
      scenarioTitle: scenario === 'cooking' ? 'Cooking at home' : 'Saved household baseline',
      scenarioDescription:
        scenario === 'cooking'
          ? 'Illustrates practical particle, grease aerosol, and combustion gas controls while cooking indoors.'
          : 'Guidance reflects your saved household settings.',
      scenarioFocusNotes:
        scenario === 'cooking' ? ['Use vented range exhaust fan before turning on burners.'] : [],
      availableScenarios: [
        {
          id: 'baseline',
          label: 'Saved household baseline',
          shortDescription: 'Saved home setup.',
        },
        {
          id: 'cooking',
          label: 'Cooking at home',
          shortDescription: 'Cooking simulation.',
        },
        {
          id: 'cleaning',
          label: 'Cleaning the house',
          shortDescription: 'Cleaning simulation.',
        },
        {
          id: 'opening_windows',
          label: 'Opening windows',
          shortDescription: 'Window airing simulation.',
        },
        {
          id: 'operating_purifier',
          label: 'Operating an air purifier',
          shortDescription: 'HEPA purifier simulation.',
        },
        {
          id: 'elevated_outdoor_pollution',
          label: 'Elevated outdoor pollution',
          shortDescription: 'High smog simulation.',
        },
      ],
    },
    ventilationGuidance: {
      state: ventilationState,
      stateLabel:
        ventilationState === 'insufficient_data'
          ? 'Insufficient outdoor data'
          : ventilationState === 'delay_optional_ventilation'
            ? 'Delay optional airing'
            : ventilationState === 'consider_ventilation'
              ? 'Consider natural ventilation'
              : 'Prefer shorter timed airing',
      headline:
        ventilationState === 'insufficient_data'
          ? 'Live outdoor data is unavailable — maintain safe essential ventilation'
          : 'Prefer brief, timed airing outside rush-hour peaks',
      summary: 'Balance indoor particle source clearing against moderate outdoor PM2.5.',
      bestWindowHint: 'Midday dispersion window (11:00 – 14:00)',
      windowDisclosure: 'Based on model forecast trends; verify visible conditions.',
      essentialSafetyReminder:
        'Never seal combustion vents, stove flues, or essential safety ventilation.',
      constraintsAndTradeoffs: [
        'Recommendations cannot prescribe universal minute durations without indoor sensors.',
      ],
      informationCategory: 'estimated_inferred_indoor',
    },
    purifierGuidance: {
      hasPurifier,
      scenarioSimulatedPurifier: simulatedPurifier,
      headline:
        hasPurifier || simulatedPurifier
          ? 'Portable HEPA Purifier Operating Guidance'
          : 'Practical Indoor Air Controls Without a Dedicated Purifier',
      summary:
        hasPurifier || simulatedPurifier
          ? 'Use continuous low/medium airflow in primary occupied rooms.'
          : 'Reduce indoor emissions first through source control and damp cleaning.',
      practicalGuidance: [
        hasPurifier || simulatedPurifier
          ? 'Place the HEPA purifier away from curtains or corners.'
          : 'Cover pots while cooking and capture dust with a damp microfiber cloth.',
      ],
      gasAndVocLimitation:
        'Standard HEPA particle filters do not capture carbon monoxide (CO) and have limited or no effect on most cleaning VOCs or combustion gases.',
      nonPurchaseNote:
        hasPurifier || simulatedPurifier
          ? null
          : 'No purifier purchase is required to follow VAYORA source-control steps.',
      informationCategory: 'general_educational_guidance',
    },
    actionPlan: [
      {
        id: 'indoor-ventilation-timing',
        title: 'Time natural window airing around cleaner forecast windows',
        status: 'recommended',
        statusLabel: 'Recommended',
        priorityScore: 90,
        informationCategory: 'estimated_inferred_indoor',
        informationCategoryLabel: 'Estimated or inferred indoor condition',
        whatToDo: 'Prefer brief airing during the Midday dispersion window.',
        whyRecommended: 'Outdoor PM2.5 dips slightly midday.',
        householdAndOutdoorContext: ['Natural window ventilation', 'US AQI 74'],
        precautionAndSafety: 'Never block essential fuel-burning appliance airflow.',
        limitations: 'No indoor sensors connected.',
        highlightedByScenario: scenario === 'opening_windows',
      },
      {
        id: 'indoor-solid-fuel-safety',
        title: 'Maintain combustion safety & active carbon monoxide alarms',
        status: 'caution',
        statusLabel: 'Safety priority',
        priorityScore: 98,
        informationCategory: 'general_educational_guidance',
        informationCategoryLabel: 'General educational guidance',
        whatToDo: 'Verify chimney flues and test carbon monoxide alarms.',
        whyRecommended: 'Solid fuel heating can release indoor soot and CO if drafts fail.',
        householdAndOutdoorContext: ['Saved heating: solid fuel'],
        precautionAndSafety: 'Evacuate immediately if a CO alarm sounds.',
        limitations: 'VAYORA cannot detect carbon monoxide.',
        highlightedByScenario: false,
      },
    ],
    pollutionSources: [
      {
        id: 'cooking_emissions',
        title: 'Cooking emissions (particulates, grease aerosols & combustion gases)',
        whatItIs: 'Fine particles and gases from cooking.',
        howItAffectsIndoorAir: 'High heat releases indoor particles rapidly.',
        practicalReductionSteps: ['Use back burners and vented exhaust fans.'],
        relevantPrecautions: ['Never use a gas oven to heat rooms.'],
        limitations: 'General educational guidance only.',
        informationCategory: 'general_educational_guidance',
        sourceReference: 'General US EPA / WHO educational principles.',
      },
      {
        id: 'cleaning_products_and_aerosols',
        title: 'Cleaning products, sprays, and household aerosols',
        whatItIs: 'VOCs and aerosolized sprays.',
        howItAffectsIndoorAir: 'Sprays suspend chemical vapors at breathing height.',
        practicalReductionSteps: ['Wipe with a damp cloth instead of misting sprays.'],
        relevantPrecautions: ['NEVER mix chlorine bleach with ammonia or vinegar.'],
        limitations: 'HEPA filters do not capture most cleaning vapors.',
        informationCategory: 'general_educational_guidance',
        sourceReference: 'Household chemical safety educational principles.',
      },
    ],
    provenanceAndSafety: {
      dataSources: ['Saved VAYORA Household Lifestyle Profile', 'Open-Meteo CC BY 4.0'],
      nonMedicalNotice:
        'General educational and environmental guidance only. VAYORA does not provide medical diagnoses.',
      limitationsSummary:
        'Recommendations do not measure indoor pollutants or replace physical CO alarms.',
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
    getIndoorAirGuidance: vi.fn(async (query?: IndoorGuidanceQueryInput) =>
      createMockIndoorResponse({ scenario: query?.scenario ?? 'baseline' }),
    ),
    refreshIndoorAirGuidance: vi.fn(async () => createMockIndoorResponse()),
    getSustainableAlternatives: vi.fn(),
    compareSustainableAlternative: vi.fn(),
    refreshSustainableAlternatives: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('IndoorAirAssistantWorkspace Component', () => {
  it('renders mandatory missing-sensor disclosure, 4-category evidence distinction matrix, ventilation & HEPA limitation, and passes WCAG 2.2 AA', async () => {
    const apiClient = buildMockClient();
    const { container } = render(
      <IndoorAirAssistantWorkspace profile={MOCK_PROFILE} apiClient={apiClient} />,
    );

    expect(await screen.findByTestId('indoor-air-assistant-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('indoor-sensor-disclosure')).toHaveTextContent(
      'Indoor air quality is not being measured. These recommendations are based on your household settings, available outdoor air-quality information and general guidance.',
    );

    expect(screen.getByTestId('evidence-distinction-measured_indoor')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-distinction-outdoor_air_quality')).toBeInTheDocument();
    expect(
      screen.getByTestId('evidence-distinction-estimated_inferred_indoor'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('evidence-distinction-general_educational_guidance'),
    ).toBeInTheDocument();

    expect(screen.getByTestId('hepa-gas-limitation')).toHaveTextContent(
      /do not capture carbon monoxide/i,
    );
    expect(screen.getByTestId('indoor-action-indoor-solid-fuel-safety')).toBeInTheDocument();
    expect(screen.getByTestId('indoor-source-cleaning_products_and_aerosols')).toHaveTextContent(
      /NEVER mix chlorine bleach with ammonia/i,
    );

    await runAxeAudit(container);
  });

  it('switches scenarios cleanly and displays illustrative simulation notice', async () => {
    const apiClient = buildMockClient();
    render(<IndoorAirAssistantWorkspace profile={MOCK_PROFILE} apiClient={apiClient} />);

    await screen.findByTestId('indoor-air-assistant-workspace');
    fireEvent.click(screen.getByRole('button', { name: 'Cooking at home' }));

    expect(await screen.findByTestId('indoor-simulation-banner')).toHaveTextContent(
      /Illustrative scenario simulation/i,
    );
    expect(apiClient.getIndoorAirGuidance).toHaveBeenCalledWith({ scenario: 'cooking' });
  });

  it('filters common indoor pollution sources and surfaces non-purchase guidance when no purifier is owned', async () => {
    const noPurifierProfile: HouseholdLifestyleRecord = {
      ...MOCK_PROFILE,
      hasIndoorAirPurifier: false,
    };
    const apiClient = buildMockClient({
      getIndoorAirGuidance: vi.fn(async () => createMockIndoorResponse({ hasPurifier: false })),
    });

    render(<IndoorAirAssistantWorkspace profile={noPurifierProfile} apiClient={apiClient} />);

    await screen.findByTestId('indoor-air-assistant-workspace');
    expect(screen.getByText(/No purifier purchase is required/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cooking emissions/i }));
    expect(screen.getByTestId('indoor-source-cooking_emissions')).toBeInTheDocument();
    expect(
      screen.queryByTestId('indoor-source-cleaning_products_and_aerosols'),
    ).not.toBeInTheDocument();
  });

  it('renders error recovery state when initial indoor guidance fetch fails', async () => {
    const apiClient = buildMockClient({
      getIndoorAirGuidance: vi.fn(async () => {
        throw new Error('Indoor backend unavailable');
      }),
      refreshIndoorAirGuidance: vi.fn(async () => createMockIndoorResponse()),
    });

    render(<IndoorAirAssistantWorkspace profile={MOCK_PROFILE} apiClient={apiClient} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Indoor backend unavailable/i);
    fireEvent.click(screen.getByRole('button', { name: /Retry indoor guidance/i }));

    await waitFor(() => {
      expect(screen.getByTestId('indoor-air-assistant-workspace')).toBeInTheDocument();
    });
  });
});
