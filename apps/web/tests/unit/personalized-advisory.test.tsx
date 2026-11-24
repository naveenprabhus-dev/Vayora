import type {
  AdvisoryCompareBodyInput,
  AdvisoryExplainBodyInput,
  ChoiceComparisonExplanationResponse,
  HouseholdLifestyleRecord,
  PersonalizedBriefingResponse,
  WhyRecommendationResponse,
} from '@uaqa/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonalizedAdvisoryWorkspace } from '../../src/features/advisory/PersonalizedAdvisoryWorkspace.tsx';
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
  ownerUid: 'uid_phase6_web',
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

function createMockBriefing(options?: {
  readonly mode?: 'gemini' | 'deterministic_fallback';
  readonly freshness?: 'fresh' | 'stale' | 'unavailable';
}): PersonalizedBriefingResponse {
  const mode = options?.mode ?? 'gemini';
  const freshness = options?.freshness ?? 'fresh';

  return {
    briefingId: 'uid_phase6_web::briefing::abc123',
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
      aqSummary: 'High outdoor PM2.5.',
      activeScaleNote: 'dual_epa_eea',
    },
    headline:
      mode === 'deterministic_fallback'
        ? 'Grounded household briefing: prioritize indoor air and bundled car errands'
        : 'Prioritize indoor protection and combine short vehicle trips today',
    summary:
      'High particulate burden calls for avoiding strenuous outdoor cycling while cutting cold-start car exhaust.',
    outdoorInfluenceSummary: 'US AQI 182 places PM2.5 in the unhealthy band.',
    indoorContextSummary: 'No indoor air sensors are connected; guidance uses home settings.',
    priorityActions: [
      {
        recommendationId: 'transport-trip-chaining-no-idling',
        sourceModule: 'alternatives',
        title: 'Combine household errands and stop vehicle idling',
        rationale: 'Cuts repeated cold-start street exhaust without adding outdoor exertion.',
        impactCategory: 'local_emissions',
        impactCategoryLabel: 'Local air pollutant emissions reduction',
        deterministicStatus: 'recommended',
      },
      {
        recommendationId: 'indoor-source-cooking',
        sourceModule: 'indoor',
        title: 'Ventilate cooking fumes directly outdoors',
        rationale: 'Lowers indoor airborne cooking particles without opening all street windows.',
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
        title: 'Combine household errands and stop vehicle idling',
        status: 'recommended',
        statusLabel: 'Suitable now',
        impactCategory: 'local_emissions',
        impactCategoryLabel: 'Local air pollutant emissions reduction',
        summary: 'Group errands into one continuous loop and switch off ignition while parked.',
        whyRecommended: 'Cold-start vehicle trips emit elevated NO2 and soot.',
        limitations: 'Requires household errand scheduling.',
        evidenceIds: ['EV-OPEN-METEO'],
      },
      {
        recommendationId: 'indoor-source-cooking',
        sourceModule: 'indoor',
        title: 'Ventilate cooking fumes directly outdoors',
        status: 'recommended_now',
        statusLabel: 'Recommended now',
        impactCategory: 'personal_exposure',
        impactCategoryLabel: 'Personal exposure reduction',
        summary: 'Use range extraction while cooking.',
        whyRecommended: 'Reduces indoor particulate build-up.',
        limitations: 'No indoor sensors connected.',
        evidenceIds: ['EV-OPEN-METEO'],
      },
    ],
    generationMeta: {
      generationMode: mode,
      model: 'gemini-4-hydrogen',
      fallbackReason:
        mode === 'deterministic_fallback'
          ? 'Gemini generation timed out; deterministic fallback activated.'
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
          : 'Fresh Open-Meteo model telemetry.',
      contextFingerprint: 'uid_phase6_web::briefing::abc123',
      cachedResult: false,
      generatedAt: '2026-11-23T09:00:00Z',
      latencyMs: 65,
      focus: 'balanced',
    },
  };
}

function createMockExplanation(input: AdvisoryExplainBodyInput): WhyRecommendationResponse {
  return {
    explanationId: `exp::${input.recommendationId}`,
    recommendation: {
      recommendationId: input.recommendationId,
      sourceModule: input.sourceModule,
      title: 'Combine household errands and stop vehicle idling',
      status: 'recommended',
      statusLabel: 'Suitable now',
      impactCategory: 'local_emissions',
      impactCategoryLabel: 'Local air pollutant emissions reduction',
      summary: 'Group errands into one continuous loop.',
      whyRecommended: 'Cold-start vehicle trips emit elevated NO2 and soot.',
      limitations: 'Requires household errand scheduling.',
      evidenceIds: ['EV-OPEN-METEO'],
    },
    headline: 'Why combining car errands reduces neighborhood exhaust',
    contextualSummary: 'Bundling trips keeps the catalytic converter warm and eliminates idling.',
    whyThisAppliesToHousehold:
      'Tailored for your 4-person Krakow household using a gas vehicle for daily errands.',
    impactExplanation: {
      action:
        'Combine separate short drives into one planned route and turn off ignition while waiting.',
      reason: 'Cold engines emit elevated tailpipe particulates and nitrogen dioxide.',
      expectedBenefit:
        'Lowers local neighborhood tailpipe pollutant emissions near homes and schools.',
      impactCategory: 'local_emissions',
      evidence: 'US EPA transportation guidance paired with Open-Meteo outdoor context.',
      limitations: 'Does not remove existing ambient PM2.5 trapped in the valley basin.',
    },
    impactCategoryLabel: 'Local air pollutant emissions reduction',
    alternativeOrTradeoffNote: 'Requires planning errands ahead of time.',
    verifiedEvidence: [
      {
        id: 'EV-OPEN-METEO',
        sourceName: 'Open-Meteo Air Quality',
        sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
        scope: 'Outdoor atmospheric model',
        relevantFinding: 'US AQI 182 unhealthy PM2.5 background.',
        limitations: 'Model output only.',
      },
    ],
    generationMeta: {
      generationMode: 'gemini',
      model: 'gemini-4-hydrogen',
      fallbackReason: null,
      aiDisclosure: 'AI-generated explanation grounded strictly in VAYORA deterministic rules.',
      nonMedicalNotice: 'Educational guidance only.',
      freshnessDisclosure: 'fresh',
      freshnessMessage: 'Fresh Open-Meteo model telemetry.',
      contextFingerprint: 'exp-fp',
      cachedResult: false,
      generatedAt: '2026-11-23T09:00:00Z',
      latencyMs: 55,
      focus: input.focus ?? 'balanced',
    },
  };
}

function createMockComparison(
  input: AdvisoryCompareBodyInput,
): ChoiceComparisonExplanationResponse {
  return {
    comparisonExplanationId: `cmp::${input.alternativeId}`,
    deterministicComparison: {
      alternativeId: input.alternativeId,
      alternativeTitle: 'Combine household errands and stop vehicle idling',
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
      ghgVsLocalPollutantDistinction: 'Local tailpipe emissions separated from CO2 conservation.',
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
    headline: 'Bundled errands vs. separate cold-start car trips',
    summary: 'Grouping errands lowers repeated cold-start exhaust bursts near sidewalks.',
    currentChoiceImpact: 'Separate drives repeatedly run cold catalytic converters and idle.',
    suggestedChoiceImpact: 'One warm-engine trip cuts local NO2 and soot emissions.',
    impactCategory: 'local_emissions',
    impactCategoryLabel: 'Local air pollutant emissions reduction',
    whyPreferableForHousehold: 'Avoids outdoor high-AQI exertion while reducing street exhaust.',
    tradeoffsAndLimitations: 'Requires trip scheduling; does not directly filter indoor air.',
    verifiedEvidence: [],
    generationMeta: {
      generationMode: 'gemini',
      model: 'gemini-4-hydrogen',
      fallbackReason: null,
      aiDisclosure: 'AI-generated explanation grounded strictly in VAYORA deterministic rules.',
      nonMedicalNotice: 'Educational guidance only.',
      freshnessDisclosure: 'fresh',
      freshnessMessage: 'Fresh Open-Meteo model telemetry.',
      contextFingerprint: 'cmp-fp',
      cachedResult: false,
      generatedAt: '2026-11-23T09:00:00Z',
      latencyMs: 50,
      focus: input.focus ?? 'balanced',
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
    getSustainableAlternatives: vi.fn(),
    compareSustainableAlternative: vi.fn(),
    refreshSustainableAlternatives: vi.fn(),
    getPersonalizedBriefing: vi.fn(async () => createMockBriefing()),
    explainRecommendation: vi.fn(async (input) => createMockExplanation(input)),
    compareChoicesExplanation: vi.fn(async (input) => createMockComparison(input)),
    refreshPersonalizedAdvisory: vi.fn(async () => createMockBriefing()),
    getAdvisoryMetrics: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('PersonalizedAdvisoryWorkspace Component (Phase 6)', () => {
  it('renders personalized daily briefing, 6-part impact breakdown, choice comparison, and passes WCAG 2.2 AA', async () => {
    const apiClient = buildMockClient();
    const { container } = render(
      <PersonalizedAdvisoryWorkspace profile={MOCK_PROFILE} apiClient={apiClient} />,
    );

    expect(await screen.findByTestId('personalized-advisory-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('advisory-origin-disclosure')).toHaveTextContent(
      /AI-generated explanation/i,
    );

    // Click "Why this recommendation?" on first briefing priority action
    const [firstWhyButton] = screen.getAllByRole('button', { name: /Why this recommendation\?/i });
    if (!firstWhyButton) {
      throw new Error('Expected at least one Why this recommendation button');
    }
    fireEvent.click(firstWhyButton);
    expect(await screen.findByTestId('why-recommendation-result')).toHaveTextContent(/1\. Action/i);
    expect(screen.getByTestId('why-recommendation-result')).toHaveTextContent(/6\. Limitations/i);

    // Switch explanation focus and run Compare My Choices
    fireEvent.click(screen.getByRole('button', { name: 'Local emissions focus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare my choices' }));

    expect(await screen.findByTestId('compare-choices-result')).toHaveTextContent(
      /Bundled errands vs\. separate cold-start car trips/i,
    );
    expect(apiClient.compareChoicesExplanation).toHaveBeenCalledWith({
      alternativeId: 'transport-trip-chaining-no-idling',
      focus: 'emissions',
    });

    await runAxeAudit(container);
  });

  it('displays explicit deterministic fallback and unavailable-data disclosures clearly', async () => {
    const apiClient = buildMockClient({
      getPersonalizedBriefing: vi.fn(async () =>
        createMockBriefing({ mode: 'deterministic_fallback', freshness: 'unavailable' }),
      ),
    });

    render(<PersonalizedAdvisoryWorkspace profile={MOCK_PROFILE} apiClient={apiClient} />);

    expect(await screen.findByTestId('personalized-advisory-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('advisory-origin-disclosure')).toHaveTextContent(
      /Deterministic fallback explanation/i,
    );
    expect(screen.getByText(/Outdoor air quality data unavailable/i)).toBeInTheDocument();
  });

  it('recovers cleanly from load failures via retry CTA', async () => {
    const apiClient = buildMockClient({
      getPersonalizedBriefing: vi.fn(async () => {
        throw new Error('Advisory service temporarily offline');
      }),
      refreshPersonalizedAdvisory: vi.fn(async () => createMockBriefing()),
    });

    render(<PersonalizedAdvisoryWorkspace profile={MOCK_PROFILE} apiClient={apiClient} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Advisory service temporarily offline/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /Retry briefing/i }));
    await waitFor(() => {
      expect(screen.getByTestId('personalized-advisory-workspace')).toBeInTheDocument();
    });
  });
});
