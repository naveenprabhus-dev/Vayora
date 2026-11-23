import type {
  InformationBasis,
  RoutineActionStatus,
  RoutineCategory,
  RoutineImpactType,
  RoutineTimePeriod,
} from '../schemas/routines.schema.ts';
import type { HouseholdLifestyleRecord } from '../schemas/profile.schema.ts';
import type {
  AirQualityLocationSummary,
  AqiReadingSummary,
  DataTransparencyInfo,
  DominantPollutantSummary,
  PollutantDetail,
} from './air-quality.ts';

export interface RoutineProfileContext {
  readonly primaryZoneType: HouseholdLifestyleRecord['locationPreferences']['primaryZoneType'];
  readonly householdSize: number;
  readonly householdComposition: HouseholdLifestyleRecord['householdComposition'];
  readonly savedCommuteMode: HouseholdLifestyleRecord['primaryCommuteMode'];
  readonly effectiveCommuteMode: HouseholdLifestyleRecord['primaryCommuteMode'];
  readonly savedOutdoorPattern: HouseholdLifestyleRecord['outdoorActivityPattern'];
  readonly effectiveOutdoorPattern: HouseholdLifestyleRecord['outdoorActivityPattern'];
  readonly heatingType: HouseholdLifestyleRecord['heatingType'];
  readonly ventilationContext: HouseholdLifestyleRecord['ventilationContext'];
  readonly hasIndoorAirPurifier: boolean;
  readonly preferredGuidanceFocus: HouseholdLifestyleRecord['lifestylePreferences']['preferredGuidanceFocus'];
  readonly isScenarioPreview: boolean;
}

export interface ForecastWindowSuggestion {
  readonly id: string;
  readonly period: RoutineTimePeriod;
  readonly startTimestamp: string;
  readonly endTimestamp: string;
  readonly label: string;
  readonly usAqiMin: number | null;
  readonly usAqiMax: number | null;
  readonly europeanAqiMin: number | null;
  readonly europeanAqiMax: number | null;
  readonly dataBasis: 'model_forecast' | 'stale_model_forecast';
  readonly rationale: string;
  readonly cautionNote: string;
}

export interface BetterTimeWindowsSummary {
  readonly status: 'available' | 'stale' | 'unavailable';
  readonly windows: readonly ForecastWindowSuggestion[];
  readonly limitationDisclosure: string;
}

export interface CommuteRecommendationOption {
  readonly id: string;
  readonly modeLabel: string;
  readonly status: RoutineActionStatus;
  readonly statusReason: string;
  readonly impactType: RoutineImpactType;
  readonly impactLabel: string;
  readonly summary: string;
  readonly reason: string;
  readonly infrastructureNote: string;
}

export interface CommuteStrategySummary {
  readonly savedMode: HouseholdLifestyleRecord['primaryCommuteMode'];
  readonly effectiveMode: HouseholdLifestyleRecord['primaryCommuteMode'];
  readonly headline: string;
  readonly exposureVsEmissionsNote: string;
  readonly options: readonly CommuteRecommendationOption[];
}

export interface RoutineExplanation {
  readonly whatToDo: string;
  readonly whyRecommended: string;
  readonly influencingData: readonly string[];
  readonly expectedBenefit: string;
  readonly limitationsAndTradeoffs: string;
}

export interface RoutineRecommendationItem {
  readonly id: string;
  readonly period: RoutineTimePeriod;
  readonly category: RoutineCategory;
  readonly title: string;
  readonly status: RoutineActionStatus;
  readonly statusReason: string;
  readonly priorityScore: number;
  readonly suggestedWindow: string;
  readonly impactType: RoutineImpactType;
  readonly impactLabel: string;
  readonly explanation: RoutineExplanation;
  readonly airQualityContext: string;
  readonly practicalAlternative: string | null;
  readonly freshnessAndUncertainty: string;
  readonly informationBasis: InformationBasis;
}

export interface RoutinePeriodGroup {
  readonly period: RoutineTimePeriod;
  readonly label: string;
  readonly windowHint: string;
  readonly periodSummary: string;
  readonly items: readonly RoutineRecommendationItem[];
}

export interface DailyRoutineOverview {
  readonly headline: string;
  readonly summary: string;
  readonly totalRecommended: number;
  readonly totalOptional: number;
  readonly totalUnavailable: number;
  readonly exposureCount: number;
  readonly emissionCount: number;
  readonly bothCount: number;
  readonly safetyAndScopeNotice: string;
}

export interface DailyRoutineResponse {
  readonly routineId: string;
  readonly generatedAt: string;
  readonly cachedResult: boolean;
  readonly location: AirQualityLocationSummary;
  readonly profileContext: RoutineProfileContext;
  readonly airQualityContext: {
    readonly usAqi: AqiReadingSummary;
    readonly europeanAqi: AqiReadingSummary;
    readonly dominantPollutant: DominantPollutantSummary;
    readonly pollutants: readonly PollutantDetail[];
    readonly transparency: DataTransparencyInfo;
  };
  readonly overview: DailyRoutineOverview;
  readonly betterTimeWindows: BetterTimeWindowsSummary;
  readonly commuteSummary: CommuteStrategySummary;
  readonly periods: readonly RoutinePeriodGroup[];
}
