import type { DataAvailabilityStatus, PollutantCode } from '@uaqa/contracts';
import { OPEN_METEO_PROVIDER_ID, POLLUTANT_CATALOG } from './air-quality.constants.ts';
import type { RawOpenMeteoAirQualityResponse } from './air-quality.schemas.ts';
import type {
  NormalizedAirQualitySnapshot,
  NormalizedHourlySlot,
  NormalizedPollutantValues,
} from './air-quality.types.ts';

export function sanitizeNonNegativeMetric(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

export function sanitizeAqiValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000) {
    return null;
  }
  return Math.round(value);
}

function seriesValueAt(
  series: readonly (number | null)[] | undefined,
  index: number,
  sanitizer: (val: unknown) => number | null,
): number | null {
  if (!series || index < 0 || index >= series.length) {
    return null;
  }
  return sanitizer(series[index]);
}

function readUnitLabel(rawUnit: string | undefined, fallback: string): string {
  return rawUnit && rawUnit.trim().length > 0 ? rawUnit.trim() : fallback;
}

export function determineSnapshotAvailability(
  pollutants: NormalizedPollutantValues,
  usAqi: number | null,
  europeanAqi: number | null,
): DataAvailabilityStatus {
  const values: (number | null)[] = [
    usAqi,
    europeanAqi,
    pollutants.pm2_5,
    pollutants.pm10,
    pollutants.no2,
    pollutants.so2,
    pollutants.co,
    pollutants.o3,
  ];
  const validCount = values.filter((val) => val !== null).length;
  if (validCount === 0) {
    return 'unavailable';
  }
  if (validCount === values.length) {
    return 'available';
  }
  return 'partial';
}

export function mapOpenMeteoResponseToSnapshot(
  raw: RawOpenMeteoAirQualityResponse,
  fetchedAtIso: string,
): NormalizedAirQualitySnapshot {
  const current = raw.current;
  const currentUnits = raw.current_units;

  const pollutants: NormalizedPollutantValues = {
    pm2_5: sanitizeNonNegativeMetric(current?.pm2_5),
    pm10: sanitizeNonNegativeMetric(current?.pm10),
    no2: sanitizeNonNegativeMetric(current?.nitrogen_dioxide),
    so2: sanitizeNonNegativeMetric(current?.sulphur_dioxide),
    co: sanitizeNonNegativeMetric(current?.carbon_monoxide),
    o3: sanitizeNonNegativeMetric(current?.ozone),
  };

  const units: Record<PollutantCode, string> = {
    pm2_5: readUnitLabel(currentUnits?.pm2_5, POLLUTANT_CATALOG.pm2_5.defaultUnit),
    pm10: readUnitLabel(currentUnits?.pm10, POLLUTANT_CATALOG.pm10.defaultUnit),
    no2: readUnitLabel(currentUnits?.nitrogen_dioxide, POLLUTANT_CATALOG.no2.defaultUnit),
    so2: readUnitLabel(currentUnits?.sulphur_dioxide, POLLUTANT_CATALOG.so2.defaultUnit),
    co: readUnitLabel(currentUnits?.carbon_monoxide, POLLUTANT_CATALOG.co.defaultUnit),
    o3: readUnitLabel(currentUnits?.ozone, POLLUTANT_CATALOG.o3.defaultUnit),
  };

  const usAqiSubIndices: Partial<Record<PollutantCode, number | null>> = {
    pm2_5: sanitizeAqiValue(current?.us_aqi_pm2_5),
    pm10: sanitizeAqiValue(current?.us_aqi_pm10),
    no2: sanitizeAqiValue(current?.us_aqi_nitrogen_dioxide),
    so2: sanitizeAqiValue(current?.us_aqi_sulphur_dioxide),
    co: sanitizeAqiValue(current?.us_aqi_carbon_monoxide),
    o3: sanitizeAqiValue(current?.us_aqi_ozone),
  };

  const hourlyTimes = raw.hourly?.time ?? [];
  const hourlySlots: NormalizedHourlySlot[] = hourlyTimes.map((timestamp, index) => ({
    timestamp,
    usAqi: seriesValueAt(raw.hourly?.us_aqi, index, sanitizeAqiValue),
    europeanAqi: seriesValueAt(raw.hourly?.european_aqi, index, sanitizeAqiValue),
    pollutants: {
      pm2_5: seriesValueAt(raw.hourly?.pm2_5, index, sanitizeNonNegativeMetric),
      pm10: seriesValueAt(raw.hourly?.pm10, index, sanitizeNonNegativeMetric),
      no2: seriesValueAt(raw.hourly?.nitrogen_dioxide, index, sanitizeNonNegativeMetric),
      so2: seriesValueAt(raw.hourly?.sulphur_dioxide, index, sanitizeNonNegativeMetric),
      co: seriesValueAt(raw.hourly?.carbon_monoxide, index, sanitizeNonNegativeMetric),
      o3: seriesValueAt(raw.hourly?.ozone, index, sanitizeNonNegativeMetric),
    },
  }));

  return {
    providerId: OPEN_METEO_PROVIDER_ID,
    latitude: raw.latitude,
    longitude: raw.longitude,
    timezone: raw.timezone?.trim() || 'UTC',
    fetchedAt: fetchedAtIso,
    current: {
      observationTimestamp: current?.time ?? null,
      usAqi: sanitizeAqiValue(current?.us_aqi),
      europeanAqi: sanitizeAqiValue(current?.european_aqi),
      usAqiSubIndices,
      pollutants,
      units,
    },
    hourly: hourlySlots,
    unitLabels: {
      usAqi: readUnitLabel(currentUnits?.us_aqi ?? raw.hourly_units?.us_aqi, 'US AQI'),
      europeanAqi: readUnitLabel(
        currentUnits?.european_aqi ?? raw.hourly_units?.european_aqi,
        'EAQI',
      ),
      pollutants: readUnitLabel(currentUnits?.pm2_5 ?? raw.hourly_units?.pm2_5, 'µg/m³'),
    },
  };
}

export function selectForecastWindow(
  hourly: readonly NormalizedHourlySlot[],
  observationTimestamp: string | null,
  hours: number,
): readonly NormalizedHourlySlot[] {
  if (hourly.length === 0) {
    return [];
  }

  let startIndex = 0;
  if (observationTimestamp) {
    const exactMatch = hourly.findIndex((slot) => slot.timestamp >= observationTimestamp);
    if (exactMatch >= 0) {
      startIndex = exactMatch;
    }
  }

  return hourly.slice(startIndex, startIndex + hours);
}
