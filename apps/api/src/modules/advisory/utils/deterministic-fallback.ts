import type {
  AdvisoryExplanationFocus,
  AdvisoryGenerationMeta,
  AdvisoryImpactCategory,
  AdvisoryPriorityAction,
  AdvisoryRecommendationCatalogEntry,
  AlternativeComparisonView,
  ChoiceComparisonExplanationResponse,
  DailyRoutineResponse,
  IndoorAirGuidanceResponse,
  MinimizedAdvisoryContext,
  PersonalizedBriefingResponse,
  SustainableAlternativesResponse,
  WhyRecommendationResponse,
} from '@uaqa/contracts';
import {
  ADVISORY_AI_DISCLOSURE,
  ADVISORY_FALLBACK_DISCLOSURE,
  ADVISORY_IMPACT_LABELS,
  ADVISORY_NON_MEDICAL_NOTICE,
} from '../advisory.constants.ts';

export function buildFreshnessMessage(context: MinimizedAdvisoryContext): string {
  switch (context.airQuality.freshnessStatus) {
    case 'fresh':
      return `Fresh Open-Meteo outdoor atmospheric model data (${context.airQuality.usAqiCategory}, US AQI ${context.airQuality.usAqiValue ?? 'N/A'} / European AQI ${context.airQuality.europeanAqiValue ?? 'N/A'}). Indoor conditions remain qualitative profile inferences with no indoor sensors connected.`;
    case 'stale':
      return 'Stale cached outdoor air-quality data is currently active because live refresh was unavailable. Re-verify conditions before strenuous outdoor activities.';
    case 'unavailable':
      return 'Live outdoor air-quality telemetry is unavailable right now. Suitability guidance defaults to cautious baseline household recommendations without inventing AQI values.';
  }
}

export function buildGenerationMeta(params: {
  readonly mode: 'gemini' | 'deterministic_fallback';
  readonly model: string;
  readonly fallbackReason: string | null;
  readonly context: MinimizedAdvisoryContext;
  readonly contextFingerprint: string;
  readonly cachedResult: boolean;
  readonly latencyMs: number;
  readonly focus: AdvisoryExplanationFocus;
}): AdvisoryGenerationMeta {
  return {
    generationMode: params.mode,
    model: params.model,
    fallbackReason: params.fallbackReason,
    aiDisclosure: params.mode === 'gemini' ? ADVISORY_AI_DISCLOSURE : ADVISORY_FALLBACK_DISCLOSURE,
    nonMedicalNotice: ADVISORY_NON_MEDICAL_NOTICE,
    freshnessDisclosure: params.context.airQuality.freshnessStatus,
    freshnessMessage: buildFreshnessMessage(params.context),
    contextFingerprint: params.contextFingerprint,
    cachedResult: params.cachedResult,
    generatedAt: new Date().toISOString(),
    latencyMs: params.latencyMs,
    focus: params.focus,
  };
}

function selectPriorityCatalogEntries(
  context: MinimizedAdvisoryContext,
): readonly AdvisoryRecommendationCatalogEntry[] {
  const priorityOrder = (item: AdvisoryRecommendationCatalogEntry): number => {
    if (
      item.status === 'not_advised_now' ||
      item.status === 'unavailable' ||
      item.status === 'caution'
    ) {
      return 0;
    }
    if (item.status === 'recommended') return 1;
    if (item.status === 'conditional' || item.status === 'optional') return 2;
    return 3;
  };

  const sorted = [...context.recommendations].sort((a, b) => priorityOrder(a) - priorityOrder(b));
  const picked: AdvisoryRecommendationCatalogEntry[] = [];
  const seenModules = new Set<string>();

  for (const entry of sorted) {
    if (!seenModules.has(entry.sourceModule) && picked.length < 3) {
      picked.push(entry);
      seenModules.add(entry.sourceModule);
    }
  }
  for (const entry of sorted) {
    if (!picked.some((p) => p.recommendationId === entry.recommendationId) && picked.length < 3) {
      picked.push(entry);
    }
  }
  return picked;
}

export function buildDeterministicBriefingFallback(input: {
  readonly briefingId: string;
  readonly context: MinimizedAdvisoryContext;
  readonly routines: DailyRoutineResponse;
  readonly indoor: IndoorAirGuidanceResponse;
  readonly alternatives: SustainableAlternativesResponse;
  readonly model: string;
  readonly fallbackReason: string;
  readonly latencyMs: number;
  readonly focus: AdvisoryExplanationFocus;
}): PersonalizedBriefingResponse {
  const { context, routines, indoor } = input;
  const topEntries = selectPriorityCatalogEntries(context);

  const priorityActions: AdvisoryPriorityAction[] = topEntries.map((entry) => ({
    recommendationId: entry.recommendationId,
    sourceModule: entry.sourceModule,
    title: entry.title,
    rationale: entry.whyRecommended,
    impactCategory: entry.impactCategory,
    impactCategoryLabel: entry.impactCategoryLabel,
    deterministicStatus: entry.status,
  }));

  const usedEvidenceIds = new Set(topEntries.flatMap((e) => e.evidenceIds));
  usedEvidenceIds.add('EV-OPEN-METEO');
  const verifiedEvidence = context.evidenceSources.filter((src) => usedEvidenceIds.has(src.id));

  const freshnessPrefix =
    context.airQuality.freshnessStatus === 'unavailable'
      ? 'Outdoor telemetry is unavailable right now — '
      : context.airQuality.freshnessStatus === 'stale'
        ? 'Using stale cached outdoor telemetry — '
        : '';

  const headline = context.airQuality.isHighOrWorse
    ? `${freshnessPrefix}Prioritize indoor exposure protection and lower-emission errands in ${context.household.city}`
    : `${freshnessPrefix}Balanced daily air-quality plan for your household in ${context.household.city}`;

  const summary =
    context.airQuality.freshnessStatus === 'unavailable'
      ? `Live outdoor air readings are currently unavailable for ${context.household.city}. This grounded fallback briefing summarizes baseline routines, indoor source precautions, and lower-emission options tailored to your ${context.household.householdSize}-person household.`
      : `Based on ${context.airQuality.usAqiCategory} outdoor conditions in ${context.household.city} (${context.household.primaryZoneType.replaceAll('_', ' ')}), this briefing separates personal exposure steps from local emission-reducing habits for your ${context.household.householdSize}-person household.`;

  return {
    briefingId: input.briefingId,
    location: routines.location,
    householdSummary: context.household,
    airQualitySnapshot: context.airQuality,
    headline,
    summary,
    outdoorInfluenceSummary: context.airQuality.aqSummary,
    indoorContextSummary: `${indoor.ventilationGuidance.headline}. ${indoor.overview.sensorStatus.disclosureStatement}`,
    priorityActions,
    cautionsAndLimitations: `${ADVISORY_NON_MEDICAL_NOTICE} ${routines.betterTimeWindows.limitationDisclosure}`,
    verifiedEvidence,
    availableRecommendations: context.recommendations,
    generationMeta: buildGenerationMeta({
      mode: 'deterministic_fallback',
      model: input.model,
      fallbackReason: input.fallbackReason,
      context,
      contextFingerprint: input.briefingId,
      cachedResult: false,
      latencyMs: input.latencyMs,
      focus: input.focus,
    }),
  };
}

export function buildDeterministicWhyFallback(input: {
  readonly explanationId: string;
  readonly context: MinimizedAdvisoryContext;
  readonly recommendation: AdvisoryRecommendationCatalogEntry;
  readonly model: string;
  readonly fallbackReason: string;
  readonly latencyMs: number;
  readonly focus: AdvisoryExplanationFocus;
}): WhyRecommendationResponse {
  const { context, recommendation } = input;
  const verifiedEvidence = context.evidenceSources.filter((src) =>
    recommendation.evidenceIds.includes(src.id),
  );
  const evidenceSummary =
    verifiedEvidence.map((src) => `${src.sourceName}: ${src.relevantFinding}`).join(' ') ||
    'Verified VAYORA household rules and Open-Meteo model context.';

  const impactBenefitByCategory: Readonly<Record<AdvisoryImpactCategory, string>> = {
    personal_exposure:
      'Focuses on reducing your household’s direct inhalation of elevated outdoor or indoor pollutants without claiming immediate neighborhood air cleanup.',
    local_emissions:
      'Helps reduce local combustion exhaust (PM2.5, NO2, CO, or smoke) emitted near your home and neighborhood streets.',
    both: 'Supports both lower household inhalation exposure and reduced local neighborhood pollutant emissions.',
    indoor_filtration:
      'Helps lower airborne indoor particulate matter or indoor pollutant build-up based qualitatively on your home setup (HEPA filters do not capture carbon monoxide).',
    greenhouse_gas:
      'Supports longer-term greenhouse gas and energy conservation goals separately from immediate daily AQI readings.',
    broader_sustainability:
      'Provides broader material and resource sustainability benefits; does not promise immediate local PM2.5 or AQI reductions today.',
  };

  return {
    explanationId: input.explanationId,
    recommendation,
    headline: `Grounded breakdown: ${recommendation.title}`,
    contextualSummary: `${recommendation.summary} Current deterministic status: ${recommendation.statusLabel}.`,
    whyThisAppliesToHousehold: `Selected for your ${context.household.householdSize}-person household in ${context.household.city} (${context.household.primaryCommuteMode.replaceAll('_', ' ')} commute, ${context.household.heatingType.replaceAll('_', ' ')} heating, ${context.household.ventilationContext.replaceAll('_', ' ')} ventilation). ${recommendation.whyRecommended}`,
    impactExplanation: {
      action: recommendation.summary,
      reason: recommendation.whyRecommended,
      expectedBenefit: impactBenefitByCategory[recommendation.impactCategory],
      impactCategory: recommendation.impactCategory,
      evidence: evidenceSummary,
      limitations: `${recommendation.limitations} (${ADVISORY_NON_MEDICAL_NOTICE})`,
    },
    impactCategoryLabel: ADVISORY_IMPACT_LABELS[recommendation.impactCategory],
    alternativeOrTradeoffNote: recommendation.limitations,
    verifiedEvidence,
    generationMeta: buildGenerationMeta({
      mode: 'deterministic_fallback',
      model: input.model,
      fallbackReason: input.fallbackReason,
      context,
      contextFingerprint: input.explanationId,
      cachedResult: false,
      latencyMs: input.latencyMs,
      focus: input.focus,
    }),
  };
}

export function mapComparisonImpactCategory(
  comparison: AlternativeComparisonView,
): AdvisoryImpactCategory {
  switch (comparison.impactClassification) {
    case 'personal_exposure':
      return 'personal_exposure';
    case 'local_emissions':
      return 'local_emissions';
    case 'both_exposure_and_emissions':
      return 'both';
    case 'broader_sustainability':
      return 'broader_sustainability';
  }
}

export function buildDeterministicComparisonFallback(input: {
  readonly comparisonExplanationId: string;
  readonly context: MinimizedAdvisoryContext;
  readonly comparison: AlternativeComparisonView;
  readonly recommendation: AdvisoryRecommendationCatalogEntry | undefined;
  readonly model: string;
  readonly fallbackReason: string;
  readonly latencyMs: number;
  readonly focus: AdvisoryExplanationFocus;
}): ChoiceComparisonExplanationResponse {
  const { context, comparison, recommendation } = input;
  const impactCategory = mapComparisonImpactCategory(comparison);
  const evidenceIds = recommendation?.evidenceIds ?? ['EV-OPEN-METEO'];
  const verifiedEvidence = context.evidenceSources.filter((src) => evidenceIds.includes(src.id));

  return {
    comparisonExplanationId: input.comparisonExplanationId,
    deterministicComparison: comparison,
    headline: `${comparison.alternativeTitle} vs. ${comparison.selectedBaselineLabel}`,
    summary: `Qualitative comparison for your household in ${context.household.city}: ${comparison.whyPreferable}`,
    currentChoiceImpact: `Baseline (${comparison.selectedBaselineLabel}): ${comparison.currentChoiceSummary} Exposure note: ${comparison.personalExposureEffect}`,
    suggestedChoiceImpact: `Suggested alternative: ${comparison.suggestedAlternativeSummary} Air-quality effect: ${comparison.directAirQualityAndEmissionsEffect}`,
    impactCategory,
    impactCategoryLabel: ADVISORY_IMPACT_LABELS[impactCategory],
    whyPreferableForHousehold: `${comparison.whyPreferable} Distinction note: ${comparison.ghgVsLocalPollutantDistinction}`,
    tradeoffsAndLimitations: `${comparison.tradeoffsAndLimitations} ${comparison.costAndAccessibility}`,
    verifiedEvidence,
    generationMeta: buildGenerationMeta({
      mode: 'deterministic_fallback',
      model: input.model,
      fallbackReason: input.fallbackReason,
      context,
      contextFingerprint: input.comparisonExplanationId,
      cachedResult: false,
      latencyMs: input.latencyMs,
      focus: input.focus,
    }),
  };
}
