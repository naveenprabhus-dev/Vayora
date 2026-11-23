import type {
  AlternativeAffordabilityTier,
  AlternativeCategory,
  AlternativeImpactClassification,
  AlternativeRelevanceScope,
  AlternativeSuitabilityStatus,
} from '../schemas/alternatives.schema.ts';
import type { HouseholdLifestyleRecord } from '../schemas/profile.schema.ts';
import type {
  AirQualityLocationSummary,
  AqiReadingSummary,
  DataTransparencyInfo,
  DominantPollutantSummary,
} from './air-quality.ts';

export interface AlternativeEvidenceReference {
  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly relevantFinding: string;
  readonly versionOrDate: string;
  readonly limitations: string;
}

export interface AlternativeBaselineOption {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly exposureRiskNote: string;
  readonly emissionProfileNote: string;
  readonly sustainabilityNote: string;
}

export interface AlternativeComparisonView {
  readonly alternativeId: string;
  readonly alternativeTitle: string;
  readonly category: AlternativeCategory;
  readonly impactClassification: AlternativeImpactClassification;
  readonly impactClassificationLabel: string;
  readonly affordabilityTier: AlternativeAffordabilityTier;
  readonly affordabilityLabel: string;
  readonly relevanceScope: AlternativeRelevanceScope;
  readonly suitabilityStatus: AlternativeSuitabilityStatus;
  readonly selectedBaselineId: string;
  readonly selectedBaselineLabel: string;
  readonly availableBaselines: readonly AlternativeBaselineOption[];
  readonly currentChoiceSummary: string;
  readonly suggestedAlternativeSummary: string;
  readonly whyPreferable: string;
  readonly directAirQualityAndEmissionsEffect: string;
  readonly personalExposureEffect: string;
  readonly broaderSustainabilityEffect: string;
  readonly ghgVsLocalPollutantDistinction: string;
  readonly costAndAccessibility: string;
  readonly tradeoffsAndLimitations: string;
  readonly infrastructureConditionality: string | null;
  readonly evidenceReference: AlternativeEvidenceReference;
}

export interface SustainableAlternativeItem {
  readonly id: string;
  readonly category: AlternativeCategory;
  readonly categoryLabel: string;
  readonly title: string;
  readonly currentHabitMatched: string;
  readonly impactClassification: AlternativeImpactClassification;
  readonly impactClassificationLabel: string;
  readonly affordabilityTier: AlternativeAffordabilityTier;
  readonly affordabilityLabel: string;
  readonly relevanceScope: AlternativeRelevanceScope;
  readonly relevanceLabel: string;
  readonly suitabilityStatus: AlternativeSuitabilityStatus;
  readonly suitabilityLabel: string;
  readonly suitabilityReason: string;
  readonly personalizationDrivers: readonly string[];
  readonly currentChoice: string;
  readonly suggestedAlternative: string;
  readonly whyPreferable: string;
  readonly directAqVsBroaderNote: string;
  readonly ghgVsLocalPollutantNote: string;
  readonly tradeoffsAndLimitations: string;
  readonly costAndAccessibilityNote: string;
  readonly infrastructureConditionality: string | null;
  readonly qualitativeComparisonNote: string;
  readonly baselineOptions: readonly AlternativeBaselineOption[];
  readonly defaultBaselineId: string;
  readonly evidenceReference: AlternativeEvidenceReference;
}

export interface AlternativeImpactDistinctionItem {
  readonly classification: AlternativeImpactClassification;
  readonly label: string;
  readonly summary: string;
  readonly localPollutantRelevance: string;
}

export interface SustainableAlternativesOverview {
  readonly headline: string;
  readonly summary: string;
  readonly totalCatalogEvaluated: number;
  readonly matchedAlternativesCount: number;
  readonly countsByCategory: Readonly<Record<AlternativeCategory, number>>;
  readonly countsByImpact: Readonly<Record<AlternativeImpactClassification, number>>;
  readonly householdSummary: {
    readonly householdSize: number;
    readonly householdComposition: readonly HouseholdLifestyleRecord['householdComposition'][number][];
    readonly primaryCommuteMode: HouseholdLifestyleRecord['primaryCommuteMode'];
    readonly heatingType: HouseholdLifestyleRecord['heatingType'];
    readonly ventilationContext: HouseholdLifestyleRecord['ventilationContext'];
    readonly primaryZoneType: HouseholdLifestyleRecord['locationPreferences']['primaryZoneType'];
  };
  readonly outdoorConditionSummary: string;
  readonly impactDistinctionLegend: readonly AlternativeImpactDistinctionItem[];
  readonly activeTransportAqiNote: string;
}

export interface SustainableAlternativesResponse {
  readonly advisoryId: string;
  readonly generatedAt: string;
  readonly cachedResult: boolean;
  readonly location: AirQualityLocationSummary;
  readonly overview: SustainableAlternativesOverview;
  readonly appliedFilters: {
    readonly category: AlternativeCategory | null;
    readonly affordability: AlternativeAffordabilityTier | null;
    readonly relevance: AlternativeRelevanceScope | null;
    readonly impactType: AlternativeImpactClassification | null;
    readonly practicality: 'recommended' | 'conditional' | null;
  };
  readonly airQualityContext: {
    readonly usAqi: AqiReadingSummary;
    readonly europeanAqi: AqiReadingSummary;
    readonly dominantPollutant: DominantPollutantSummary;
    readonly transparency: DataTransparencyInfo;
  };
  readonly alternatives: readonly SustainableAlternativeItem[];
  readonly featuredComparison: AlternativeComparisonView | null;
  readonly provenanceAndDisclosures: {
    readonly dataSources: readonly string[];
    readonly methodologicalPrinciples: readonly string[];
    readonly limitationsSummary: string;
  };
}
