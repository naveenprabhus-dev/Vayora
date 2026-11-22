import type { PollutantCode } from '@uaqa/contracts';

export interface NormalizedPollutantValues {
  readonly pm2_5: number | null;
  readonly pm10: number | null;
  readonly no2: number | null;
  readonly so2: number | null;
  readonly co: number | null;
  readonly o3: number | null;
}

export interface NormalizedCurrentReading {
  readonly observationTimestamp: string | null;
  readonly usAqi: number | null;
  readonly europeanAqi: number | null;
  readonly usAqiSubIndices: Readonly<Partial<Record<PollutantCode, number | null>>>;
  readonly pollutants: NormalizedPollutantValues;
  readonly units: Readonly<Record<PollutantCode, string>>;
}

export interface NormalizedHourlySlot {
  readonly timestamp: string;
  readonly usAqi: number | null;
  readonly europeanAqi: number | null;
  readonly pollutants: NormalizedPollutantValues;
}

export interface NormalizedAirQualitySnapshot {
  readonly providerId: 'open-meteo';
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly fetchedAt: string;
  readonly current: NormalizedCurrentReading;
  readonly hourly: readonly NormalizedHourlySlot[];
  readonly unitLabels: {
    readonly usAqi: string;
    readonly europeanAqi: string;
    readonly pollutants: string;
  };
}

export interface GeocodedCoordinateResult {
  readonly latitude: number;
  readonly longitude: number;
  readonly resolvedLabel: string;
  readonly country: string;
  readonly timezone: string;
}

export interface AirQualityCacheEntry {
  readonly cacheKey: string;
  readonly snapshot: NormalizedAirQualitySnapshot;
  readonly cachedAtMs: number;
}

export interface GeocodeCacheEntry {
  readonly cacheKey: string;
  readonly value: GeocodedCoordinateResult | null;
  readonly cachedAtMs: number;
}
