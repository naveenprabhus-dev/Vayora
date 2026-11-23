import type { AlternativeComparisonView, SustainableAlternativeItem } from '@uaqa/contracts';

export function buildAlternativeComparison(
  item: SustainableAlternativeItem,
  requestedBaselineId?: string,
): AlternativeComparisonView {
  const matchedBaseline =
    (requestedBaselineId
      ? item.baselineOptions.find((option) => option.id === requestedBaselineId)
      : undefined) ??
    item.baselineOptions.find((option) => option.id === item.defaultBaselineId) ??
    item.baselineOptions[0];

  const selectedBaselineId = matchedBaseline?.id ?? 'default_baseline';
  const selectedBaselineLabel = matchedBaseline?.label ?? 'Current typical choice';
  const currentChoiceSummary = matchedBaseline?.summary ?? item.currentChoice;

  const directAirQualityAndEmissionsEffect = matchedBaseline
    ? `${item.directAqVsBroaderNote} Relative to "${matchedBaseline.label}": ${matchedBaseline.emissionProfileNote}`
    : item.directAqVsBroaderNote;

  const personalExposureEffect = matchedBaseline
    ? `Baseline personal exposure context: ${matchedBaseline.exposureRiskNote} Alternative suitability: ${item.suitabilityReason}`
    : item.suitabilityReason;

  const broaderSustainabilityEffect = matchedBaseline
    ? `Baseline resource profile: ${matchedBaseline.sustainabilityNote} ${item.qualitativeComparisonNote}`
    : item.qualitativeComparisonNote;

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
    selectedBaselineId,
    selectedBaselineLabel,
    availableBaselines: item.baselineOptions,
    currentChoiceSummary,
    suggestedAlternativeSummary: item.suggestedAlternative,
    whyPreferable: item.whyPreferable,
    directAirQualityAndEmissionsEffect,
    personalExposureEffect,
    broaderSustainabilityEffect,
    ghgVsLocalPollutantDistinction: item.ghgVsLocalPollutantNote,
    costAndAccessibility: item.costAndAccessibilityNote,
    tradeoffsAndLimitations: item.tradeoffsAndLimitations,
    infrastructureConditionality: item.infrastructureConditionality,
    evidenceReference: item.evidenceReference,
  };
}
