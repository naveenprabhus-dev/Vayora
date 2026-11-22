import type {
  DataAvailabilityStatus,
  DataFreshnessStatus,
  DataNature,
  DataTransparencyInfo,
} from '@uaqa/contracts';
import { OPEN_METEO_ATTRIBUTION, OPEN_METEO_PROVIDER_NAME } from '../air-quality.constants.ts';

export interface FreshnessEvaluationInput {
  readonly isStaleFallback: boolean;
  readonly hasValidData: boolean;
  readonly availabilityStatus: DataAvailabilityStatus;
  readonly observationTimestamp: string | null;
  readonly fetchedAt: string;
  readonly cacheAgeSeconds: number | null;
  readonly fallbackReason: string | null;
}

export function evaluateFreshnessStatus(input: FreshnessEvaluationInput): {
  readonly freshnessStatus: DataFreshnessStatus;
  readonly dataNature: DataNature;
  readonly transparency: DataTransparencyInfo;
} {
  let freshnessStatus: DataFreshnessStatus = 'unavailable';
  if (input.hasValidData) {
    freshnessStatus = input.isStaleFallback ? 'stale' : 'fresh';
  }

  const dataNature: DataNature = input.hasValidData ? 'model_forecast' : 'unavailable';

  const dataNatureDisclosure =
    dataNature === 'model_forecast'
      ? 'Model-generated atmospheric chemistry estimate and hourly forecast from Open-Meteo (not direct ground-station sensor measurements).'
      : 'Live air quality telemetry is currently unavailable from the upstream provider; no placeholder or fabricated values are displayed.';

  return {
    freshnessStatus,
    dataNature,
    transparency: {
      providerId: 'open-meteo',
      providerName: OPEN_METEO_PROVIDER_NAME,
      dataNature,
      dataNatureDisclosure,
      attribution: OPEN_METEO_ATTRIBUTION,
      freshnessStatus,
      availabilityStatus: input.availabilityStatus,
      observationTimestamp: input.observationTimestamp,
      fetchedAt: input.fetchedAt,
      cacheAgeSeconds: input.cacheAgeSeconds,
      fallbackActive: input.isStaleFallback || !input.hasValidData,
      fallbackReason: input.fallbackReason,
      methodologySummary:
        'US AQI uses US EPA 0–500 pollutant-specific breakpoints (never averaging concentrations); European AQI uses the EEA 0–100+ six-band threshold scale.',
    },
  };
}
