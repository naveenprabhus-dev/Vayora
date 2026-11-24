import { Type, type Schema } from '@google/genai';
import type {
  AdvisoryEvidenceSource,
  AdvisoryExplanationFocus,
  AdvisoryRecommendationCatalogEntry,
  AlternativeComparisonView,
  MinimizedAdvisoryContext,
} from '@uaqa/contracts';
import { ADVISORY_IMPACT_CATEGORIES } from '@uaqa/contracts';
import { ADVISORY_MAX_PROMPT_CHARS } from '../advisory.constants.ts';

function compactEvidenceList(sources: readonly AdvisoryEvidenceSource[]) {
  return sources.map((item) => ({
    id: item.id,
    sourceName: item.sourceName,
    relevantFinding: item.relevantFinding,
    limitations: item.limitations,
  }));
}

function compactCatalogEntries(entries: readonly AdvisoryRecommendationCatalogEntry[]) {
  return entries.slice(0, 14).map((entry) => ({
    recommendationId: entry.recommendationId,
    sourceModule: entry.sourceModule,
    title: entry.title,
    status: entry.status,
    impactCategory: entry.impactCategory,
    summary: entry.summary,
    limitations: entry.limitations,
    evidenceIds: entry.evidenceIds,
  }));
}

function serializeVerifiedBlock(payload: unknown): string {
  const serialized = JSON.stringify(payload, null, 2);
  if (serialized.length <= ADVISORY_MAX_PROMPT_CHARS) {
    return serialized;
  }
  return serialized.slice(0, ADVISORY_MAX_PROMPT_CHARS);
}

export const GEMINI_BRIEFING_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    summary: { type: Type.STRING },
    outdoorInfluenceSummary: { type: Type.STRING },
    indoorContextSummary: { type: Type.STRING },
    priorityActions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          recommendationId: { type: Type.STRING },
          sourceModule: {
            type: Type.STRING,
            enum: ['routines', 'indoor', 'alternatives'],
          },
          title: { type: Type.STRING },
          rationale: { type: Type.STRING },
          impactCategory: {
            type: Type.STRING,
            enum: [...ADVISORY_IMPACT_CATEGORIES],
          },
        },
        required: ['recommendationId', 'sourceModule', 'title', 'rationale', 'impactCategory'],
      },
    },
    cautionsAndLimitations: { type: Type.STRING },
    evidenceRefIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    'headline',
    'summary',
    'outdoorInfluenceSummary',
    'indoorContextSummary',
    'priorityActions',
    'cautionsAndLimitations',
    'evidenceRefIds',
  ],
};

export const GEMINI_EXPLANATION_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    contextualSummary: { type: Type.STRING },
    whyThisAppliesToHousehold: { type: Type.STRING },
    impactExplanation: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING },
        reason: { type: Type.STRING },
        expectedBenefit: { type: Type.STRING },
        impactCategory: {
          type: Type.STRING,
          enum: [...ADVISORY_IMPACT_CATEGORIES],
        },
        evidence: { type: Type.STRING },
        limitations: { type: Type.STRING },
      },
      required: [
        'action',
        'reason',
        'expectedBenefit',
        'impactCategory',
        'evidence',
        'limitations',
      ],
    },
    alternativeOrTradeoffNote: { type: Type.STRING },
    evidenceRefIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    'headline',
    'contextualSummary',
    'whyThisAppliesToHousehold',
    'impactExplanation',
    'alternativeOrTradeoffNote',
    'evidenceRefIds',
  ],
};

export const GEMINI_COMPARISON_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    summary: { type: Type.STRING },
    currentChoiceImpact: { type: Type.STRING },
    suggestedChoiceImpact: { type: Type.STRING },
    impactCategory: {
      type: Type.STRING,
      enum: [...ADVISORY_IMPACT_CATEGORIES],
    },
    whyPreferableForHousehold: { type: Type.STRING },
    tradeoffsAndLimitations: { type: Type.STRING },
    evidenceRefIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    'headline',
    'summary',
    'currentChoiceImpact',
    'suggestedChoiceImpact',
    'impactCategory',
    'whyPreferableForHousehold',
    'tradeoffsAndLimitations',
    'evidenceRefIds',
  ],
};

export function buildBriefingPrompt(
  context: MinimizedAdvisoryContext,
  focus: AdvisoryExplanationFocus,
): string {
  const payload = {
    task: 'personalized_daily_briefing',
    requestedFocus: focus,
    household: context.household,
    airQuality: context.airQuality,
    indoorSensorConnected: context.indoorSensorConnected,
    ventilationStateLabel: context.ventilationStateLabel,
    allowedRecommendationIds: context.recommendations.slice(0, 14).map((r) => r.recommendationId),
    recommendations: compactCatalogEntries(context.recommendations),
    allowedEvidenceIds: context.evidenceSources.map((s) => s.id),
    evidenceSources: compactEvidenceList(context.evidenceSources),
  };

  return `Generate a concise, household-specific daily air-quality briefing using ONLY the facts inside <VERIFIED_DATA_JSON>.
Highlight up to 3 priority actions from allowedRecommendationIds, clearly disclose if air quality telemetry is stale or unavailable, remind that indoor sensors are not connected, and never invent numerical claims or override deterministic status flags.

<VERIFIED_DATA_JSON>
${serializeVerifiedBlock(payload)}
</VERIFIED_DATA_JSON>`;
}

export function buildExplainRecommendationPrompt(input: {
  readonly context: MinimizedAdvisoryContext;
  readonly recommendation: AdvisoryRecommendationCatalogEntry;
  readonly focus: AdvisoryExplanationFocus;
}): string {
  const relevantEvidence = input.context.evidenceSources.filter((src) =>
    input.recommendation.evidenceIds.includes(src.id),
  );

  const payload = {
    task: 'why_this_recommendation_and_impact_explanation',
    requestedFocus: input.focus,
    household: input.context.household,
    airQuality: input.context.airQuality,
    indoorSensorConnected: input.context.indoorSensorConnected,
    selectedRecommendation: input.recommendation,
    allowedEvidenceIds: relevantEvidence.map((src) => src.id),
    evidenceSources: compactEvidenceList(relevantEvidence),
  };

  return `Explain "Why This Recommendation?" and produce a structured 6-part impactExplanation (action, reason, expectedBenefit, impactCategory, evidence, limitations) using ONLY the facts inside <VERIFIED_DATA_JSON>.
Keep personal_exposure, local_emissions, both, indoor_filtration, greenhouse_gas, and broader_sustainability strictly distinct, match impactCategory to the deterministic recommendation (${input.recommendation.impactCategory}), and cite ONLY IDs from allowedEvidenceIds.

<VERIFIED_DATA_JSON>
${serializeVerifiedBlock(payload)}
</VERIFIED_DATA_JSON>`;
}

export function buildCompareChoicesPrompt(input: {
  readonly context: MinimizedAdvisoryContext;
  readonly comparison: AlternativeComparisonView;
  readonly recommendation: AdvisoryRecommendationCatalogEntry | undefined;
  readonly focus: AdvisoryExplanationFocus;
}): string {
  const evidenceIds = input.recommendation?.evidenceIds ?? ['EV-OPEN-METEO'];
  const relevantEvidence = input.context.evidenceSources.filter((src) =>
    evidenceIds.includes(src.id),
  );

  const payload = {
    task: 'compare_my_choices_explanation',
    requestedFocus: input.focus,
    household: input.context.household,
    airQuality: input.context.airQuality,
    deterministicComparison: {
      alternativeId: input.comparison.alternativeId,
      alternativeTitle: input.comparison.alternativeTitle,
      suitabilityStatus: input.comparison.suitabilityStatus,
      impactClassification: input.comparison.impactClassification,
      selectedBaselineLabel: input.comparison.selectedBaselineLabel,
      currentChoiceSummary: input.comparison.currentChoiceSummary,
      suggestedAlternativeSummary: input.comparison.suggestedAlternativeSummary,
      whyPreferable: input.comparison.whyPreferable,
      directAirQualityAndEmissionsEffect: input.comparison.directAirQualityAndEmissionsEffect,
      personalExposureEffect: input.comparison.personalExposureEffect,
      broaderSustainabilityEffect: input.comparison.broaderSustainabilityEffect,
      ghgVsLocalPollutantDistinction: input.comparison.ghgVsLocalPollutantDistinction,
      tradeoffsAndLimitations: input.comparison.tradeoffsAndLimitations,
    },
    allowedEvidenceIds: relevantEvidence.map((src) => src.id),
    evidenceSources: compactEvidenceList(relevantEvidence),
  };

  return `Explain "Compare My Choices" for this household using ONLY the deterministic comparison and context in <VERIFIED_DATA_JSON>.
Explicitly separate immediate local pollutant effects from personal inhalation exposure and broader sustainability or greenhouse gas benefits, never invent percentage or monetary savings, and cite ONLY IDs from allowedEvidenceIds.

<VERIFIED_DATA_JSON>
${serializeVerifiedBlock(payload)}
</VERIFIED_DATA_JSON>`;
}
