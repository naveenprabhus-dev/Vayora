import type {
  AqiScaleId,
  DataAvailabilityStatus,
  DataFreshnessStatus,
  DataNature,
  PollutantCode,
  PollutionLevelBand,
} from '../schemas/air-quality.schema.ts';

export interface AirQualityLocationSummary {
  readonly city: string;
  readonly neighborhood: string;
  readonly country: string;
  readonly postalPrefix: string;
  readonly resolvedLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly resolutionSource: 'saved_profile_geocoded' | 'explicit_coordinates';
}

export interface AqiReadingSummary {
  readonly scale: AqiScaleId;
  readonly scaleLabel: string;
  readonly authorityLabel: string;
  readonly value: number | null;
  readonly status: 'available' | 'unavailable';
  readonly category: string;
  readonly pollutionLevel: PollutionLevelBand;
  readonly pollutionLevelLabel: string;
  readonly severityToken: 'good' | 'moderate' | 'elevated' | 'high' | 'very_high' | 'unavailable';
  readonly meaning: string;
  readonly precautionSummary: string;
  readonly methodologyNote: string;
}

export interface DominantPollutantSummary {
  readonly status: 'available' | 'unavailable';
  readonly code: PollutantCode | null;
  readonly abbreviation: string | null;
  readonly fullName: string | null;
  readonly basis: 'provider_sub_index' | 'epa_breakpoint_estimate' | 'unavailable';
  readonly estimatedSubIndex: number | null;
  readonly explanation: string;
}

export interface PollutantDetail {
  readonly code: PollutantCode;
  readonly fullName: string;
  readonly abbreviation: string;
  readonly concentration: number | null;
  readonly unit: string;
  readonly status: 'available' | 'unavailable';
  readonly concentrationBand: 'low' | 'moderate' | 'elevated' | 'high' | 'unavailable';
  readonly concentrationBandLabel: string;
  readonly explanation: string;
  readonly distinctionNote: string;
}

export interface HourlyForecastPoint {
  readonly timestamp: string;
  readonly usAqi: number | null;
  readonly europeanAqi: number | null;
  readonly pm25: number | null;
  readonly pm10: number | null;
  readonly no2: number | null;
  readonly so2: number | null;
  readonly co: number | null;
  readonly o3: number | null;
  readonly availability: DataAvailabilityStatus;
}

export interface GuidanceActionItem {
  readonly id: string;
  readonly category:
    'outdoor_activity' | 'exposure_reduction' | 'ventilation' | 'household' | 'commute';
  readonly title: string;
  readonly recommendation: string;
  readonly evidenceBasis: string;
}

export interface WinterSmogGuidance {
  readonly status: 'measured_evidence' | 'stale_evidence' | 'general_precaution';
  readonly headline: string;
  readonly summary: string;
  readonly fogDistinctionNote: string;
  readonly guidanceScopeNote: string;
  readonly actions: readonly GuidanceActionItem[];
}

export interface DataTransparencyInfo {
  readonly providerId: 'open-meteo';
  readonly providerName: string;
  readonly dataNature: DataNature;
  readonly dataNatureDisclosure: string;
  readonly attribution: string;
  readonly freshnessStatus: DataFreshnessStatus;
  readonly availabilityStatus: DataAvailabilityStatus;
  readonly observationTimestamp: string | null;
  readonly fetchedAt: string;
  readonly cacheAgeSeconds: number | null;
  readonly fallbackActive: boolean;
  readonly fallbackReason: string | null;
  readonly methodologySummary: string;
}

export interface AirQualityCurrentResponse {
  readonly location: AirQualityLocationSummary;
  readonly aqi: {
    readonly usAqi: AqiReadingSummary;
    readonly europeanAqi: AqiReadingSummary;
    readonly dominantPollutant: DominantPollutantSummary;
  };
  readonly pollutants: readonly PollutantDetail[];
  readonly forecastPreview: readonly HourlyForecastPoint[];
  readonly guidance: WinterSmogGuidance;
  readonly transparency: DataTransparencyInfo;
}

export interface AirQualityForecastResponse {
  readonly location: AirQualityLocationSummary;
  readonly horizonHours: number;
  readonly dataNature: DataNature;
  readonly units: {
    readonly usAqi: string;
    readonly europeanAqi: string;
    readonly pollutants: string;
  };
  readonly hourly: readonly HourlyForecastPoint[];
  readonly transparency: DataTransparencyInfo;
}

export interface AirQualityPollutantsResponse {
  readonly location: AirQualityLocationSummary;
  readonly pollutants: readonly PollutantDetail[];
  readonly dominantPollutant: DominantPollutantSummary;
  readonly transparency: DataTransparencyInfo;
}

export interface AirQualityGuidanceResponse {
  readonly location: AirQualityLocationSummary;
  readonly guidance: WinterSmogGuidance;
  readonly transparency: DataTransparencyInfo;
}

export interface AirQualityHealthResponse {
  readonly status: 'ok' | 'degraded';
  readonly provider: 'open-meteo';
  readonly providerReachable: boolean;
  readonly airQualityCacheEntries: number;
  readonly geocodingCacheEntries: number;
  readonly cacheTtlSeconds: number;
  readonly staleTtlSeconds: number;
  readonly checkedAt: string;
}

export interface AirQualityLocationUpdateResponse {
  readonly location: AirQualityLocationSummary;
  readonly updatedAt: string;
}
