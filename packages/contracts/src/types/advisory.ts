import type {
  AdvisoryExplanationFocus,
  AdvisoryFreshnessDisclosure,
  AdvisoryGenerationMode,
  AdvisoryImpactCategory,
  AdvisorySourceModule,
  ImpactExplanation,
} from '../schemas/advisory.schema.ts';
import type { AqiScaleId, DataAvailabilityStatus } from '../schemas/air-quality.schema.ts';
import type { HouseholdLifestyleRecord } from '../schemas/profile.schema.ts';
import type { AirQualityLocationSummary } from './air-quality.ts';
import type { AlternativeComparisonView } from './alternatives.ts';

export interface AdvisoryEvidenceSource {
  readonly id: string;
  readonly sourceName: string;
  readonly sourceUrl: string | null;
  readonly scope: string;
  readonly relevantFinding: string;
  readonly limitations: string;
}

export interface AdvisoryRecommendationCatalogEntry {
  readonly recommendationId: string;
  readonly sourceModule: AdvisorySourceModule;
  readonly title: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly impactCategory: AdvisoryImpactCategory;
  readonly impactCategoryLabel: string;
  readonly summary: string;
  readonly whyRecommended: string;
  readonly limitations: string;
  readonly evidenceIds: readonly string[];
}

export interface MinimizedHouseholdAdvisoryProfile {
  readonly city: string;
  readonly neighborhood: string;
  readonly primaryZoneType: HouseholdLifestyleRecord['locationPreferences']['primaryZoneType'];
  readonly householdSize: number;
  readonly householdComposition: readonly HouseholdLifestyleRecord['householdComposition'][number][];
  readonly primaryCommuteMode: HouseholdLifestyleRecord['primaryCommuteMode'];
  readonly outdoorActivityPattern: HouseholdLifestyleRecord['outdoorActivityPattern'];
  readonly ventilationContext: HouseholdLifestyleRecord['ventilationContext'];
  readonly hasIndoorAirPurifier: boolean;
  readonly heatingType: HouseholdLifestyleRecord['heatingType'];
  readonly preferredGuidanceFocus: HouseholdLifestyleRecord['lifestylePreferences']['preferredGuidanceFocus'];
}

export interface MinimizedAirQualitySnapshot {
  readonly freshnessStatus: AdvisoryFreshnessDisclosure;
  readonly availabilityStatus: DataAvailabilityStatus;
  readonly observationTimestamp: string | null;
  readonly usAqiValue: number | null;
  readonly usAqiCategory: string;
  readonly europeanAqiValue: number | null;
  readonly europeanAqiCategory: string;
  readonly dominantPollutantCode: string | null;
  readonly dominantPollutantLabel: string | null;
  readonly isHighOrWorse: boolean;
  readonly isElevatedOrWorse: boolean;
  readonly isCyclingNotAdvised: boolean;
  readonly bestForecastWindowLabel: string | null;
  readonly aqSummary: string;
  readonly activeScaleNote: AqiScaleId | 'dual_epa_eea';
}

export interface MinimizedAdvisoryContext {
  readonly household: MinimizedHouseholdAdvisoryProfile;
  readonly airQuality: MinimizedAirQualitySnapshot;
  readonly indoorSensorConnected: false;
  readonly ventilationStateLabel: string;
  readonly recommendations: readonly AdvisoryRecommendationCatalogEntry[];
  readonly evidenceSources: readonly AdvisoryEvidenceSource[];
  readonly suppliedNumericFacts: readonly string[];
}

export interface AdvisoryGenerationMeta {
  readonly generationMode: AdvisoryGenerationMode;
  readonly model: string;
  readonly fallbackReason: string | null;
  readonly aiDisclosure: string;
  readonly nonMedicalNotice: string;
  readonly freshnessDisclosure: AdvisoryFreshnessDisclosure;
  readonly freshnessMessage: string;
  readonly contextFingerprint: string;
  readonly cachedResult: boolean;
  readonly generatedAt: string;
  readonly latencyMs: number;
  readonly focus: AdvisoryExplanationFocus;
}

export interface AdvisoryPriorityAction {
  readonly recommendationId: string;
  readonly sourceModule: AdvisorySourceModule;
  readonly title: string;
  readonly rationale: string;
  readonly impactCategory: AdvisoryImpactCategory;
  readonly impactCategoryLabel: string;
  readonly deterministicStatus: string;
}

export interface PersonalizedBriefingResponse {
  readonly briefingId: string;
  readonly location: AirQualityLocationSummary;
  readonly householdSummary: MinimizedHouseholdAdvisoryProfile;
  readonly airQualitySnapshot: MinimizedAirQualitySnapshot;
  readonly headline: string;
  readonly summary: string;
  readonly outdoorInfluenceSummary: string;
  readonly indoorContextSummary: string;
  readonly priorityActions: readonly AdvisoryPriorityAction[];
  readonly cautionsAndLimitations: string;
  readonly verifiedEvidence: readonly AdvisoryEvidenceSource[];
  readonly availableRecommendations: readonly AdvisoryRecommendationCatalogEntry[];
  readonly generationMeta: AdvisoryGenerationMeta;
}

export interface WhyRecommendationResponse {
  readonly explanationId: string;
  readonly recommendation: AdvisoryRecommendationCatalogEntry;
  readonly headline: string;
  readonly contextualSummary: string;
  readonly whyThisAppliesToHousehold: string;
  readonly impactExplanation: ImpactExplanation;
  readonly impactCategoryLabel: string;
  readonly alternativeOrTradeoffNote: string;
  readonly verifiedEvidence: readonly AdvisoryEvidenceSource[];
  readonly generationMeta: AdvisoryGenerationMeta;
}

export interface ChoiceComparisonExplanationResponse {
  readonly comparisonExplanationId: string;
  readonly deterministicComparison: AlternativeComparisonView;
  readonly headline: string;
  readonly summary: string;
  readonly currentChoiceImpact: string;
  readonly suggestedChoiceImpact: string;
  readonly impactCategory: AdvisoryImpactCategory;
  readonly impactCategoryLabel: string;
  readonly whyPreferableForHousehold: string;
  readonly tradeoffsAndLimitations: string;
  readonly verifiedEvidence: readonly AdvisoryEvidenceSource[];
  readonly generationMeta: AdvisoryGenerationMeta;
}

export interface AdvisoryOperationalMetrics {
  readonly geminiRequests: number;
  readonly geminiSuccesses: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly coalescedRequests: number;
  readonly timeouts: number;
  readonly validationFailures: number;
  readonly fallbackCount: number;
  readonly averageLatencyMs: number;
  readonly totalTokensUsed: number;
  readonly lastFallbackReason: string | null;
}
