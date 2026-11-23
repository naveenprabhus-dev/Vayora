import type {
  AirQualityCurrentResponse,
  HouseholdLifestyleRecord,
  PollutantCode,
  PollutionLevelBand,
  RoutineTimePeriod,
} from '@uaqa/contracts';

export interface EvaluatedAirQualityState {
  readonly effectiveLevel: PollutionLevelBand;
  readonly isUnavailable: boolean;
  readonly isStale: boolean;
  readonly isElevatedOrWorse: boolean;
  readonly isHighOrWorse: boolean;
  readonly isPmElevated: boolean;
  readonly isNo2Elevated: boolean;
  readonly isOzoneElevated: boolean;
  readonly isSo2Elevated: boolean;
  readonly isCoElevated: boolean;
  readonly dominantCode: PollutantCode | null;
  readonly dominantLabel: string;
  readonly usAqiSnippet: string;
  readonly europeanAqiSnippet: string;
  readonly aqContextSummary: string;
  readonly freshnessNote: string;
}

export interface RoutineGenerationContext {
  readonly profile: HouseholdLifestyleRecord;
  readonly effectiveCommuteMode: HouseholdLifestyleRecord['primaryCommuteMode'];
  readonly effectiveOutdoorPattern: HouseholdLifestyleRecord['outdoorActivityPattern'];
  readonly isScenarioPreview: boolean;
  readonly airQuality: AirQualityCurrentResponse;
  readonly aqState: EvaluatedAirQualityState;
  readonly localHoursByPeriod: Readonly<Record<RoutineTimePeriod, string>>;
}
