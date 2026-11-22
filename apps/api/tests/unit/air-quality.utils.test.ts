import { describe, expect, it } from 'vitest';
import {
  mapOpenMeteoResponseToSnapshot,
  sanitizeAqiValue,
  sanitizeNonNegativeMetric,
  selectForecastWindow,
} from '../../src/modules/air-quality/air-quality.mapper.ts';
import {
  AirQualityCacheRepository,
  buildAirQualityCacheKey,
} from '../../src/modules/air-quality/air-quality.repository.ts';
import type { RawOpenMeteoAirQualityResponse } from '../../src/modules/air-quality/air-quality.schemas.ts';
import {
  computeEpaPollutantSubIndex,
  identifyDominantPollutant,
  interpretEuropeanAqi,
  interpretUsAqi,
} from '../../src/modules/air-quality/utils/aqi-interpreter.ts';
import { evaluateFreshnessStatus } from '../../src/modules/air-quality/utils/data-freshness.ts';
import { interpretPollutants } from '../../src/modules/air-quality/utils/pollutant-interpreter.ts';
import { buildWinterSmogGuidance } from '../../src/modules/air-quality/utils/winter-smog-guidance.ts';

const SAMPLE_RAW_RESPONSE: RawOpenMeteoAirQualityResponse = {
  latitude: 50.06,
  longitude: 19.94,
  timezone: 'Europe/Warsaw',
  current_units: {
    pm2_5: 'µg/m³',
    pm10: 'µg/m³',
    nitrogen_dioxide: 'µg/m³',
    sulphur_dioxide: 'µg/m³',
    carbon_monoxide: 'µg/m³',
    ozone: 'µg/m³',
    us_aqi: 'US AQI',
    european_aqi: 'EAQI',
  },
  current: {
    time: '2026-11-22T12:00',
    pm2_5: 38.4,
    pm10: 52.0,
    nitrogen_dioxide: 41.2,
    sulphur_dioxide: 12.5,
    carbon_monoxide: 540,
    ozone: 32.0,
    us_aqi: 108,
    european_aqi: 66,
    us_aqi_pm2_5: 108,
    us_aqi_pm10: 49,
    us_aqi_nitrogen_dioxide: 21,
    us_aqi_sulphur_dioxide: 7,
    us_aqi_carbon_monoxide: 5,
    us_aqi_ozone: 15,
  },
  hourly: {
    time: ['2026-11-22T11:00', '2026-11-22T12:00', '2026-11-22T13:00', '2026-11-22T14:00'],
    us_aqi: [95, 108, null, 118],
    european_aqi: [58, 66, 72, null],
    pm2_5: [33.0, 38.4, 42.1, -5],
    pm10: [48.0, 52.0, 57.0, 60.0],
    nitrogen_dioxide: [35.0, 41.2, 44.0, 46.0],
    sulphur_dioxide: [10.0, 12.5, 13.0, 14.0],
    carbon_monoxide: [490, 540, 560, 580],
    ozone: [30, 32, 34, 36],
  },
};

describe('Air Quality Intelligence Unit Suite', () => {
  describe('Open-Meteo normalization & sanitization', () => {
    it('normalizes valid values and rejects negative/non-finite readings cleanly without inventing numbers', () => {
      expect(sanitizeNonNegativeMetric(-2.5)).toBeNull();
      expect(sanitizeNonNegativeMetric(Number.NaN)).toBeNull();
      expect(sanitizeNonNegativeMetric(24.567)).toBe(24.57);
      expect(sanitizeAqiValue(1200)).toBeNull();
      expect(sanitizeAqiValue(84.6)).toBe(85);

      const snapshot = mapOpenMeteoResponseToSnapshot(
        SAMPLE_RAW_RESPONSE,
        '2026-11-22T12:05:00.000Z',
      );
      expect(snapshot.current.usAqi).toBe(108);
      expect(snapshot.current.europeanAqi).toBe(66);
      expect(snapshot.current.pollutants.pm2_5).toBe(38.4);
      // Negative pm2_5 in hourly slot 3 is sanitized to null
      expect(snapshot.hourly[3]?.pollutants.pm2_5).toBeNull();
      // Null usAqi in hourly slot 2 stays null (never interpolated)
      expect(snapshot.hourly[2]?.usAqi).toBeNull();
    });

    it('selects forecast window starting from observation timestamp', () => {
      const snapshot = mapOpenMeteoResponseToSnapshot(
        SAMPLE_RAW_RESPONSE,
        '2026-11-22T12:05:00.000Z',
      );
      const window = selectForecastWindow(
        snapshot.hourly,
        snapshot.current.observationTimestamp,
        2,
      );
      expect(window).toHaveLength(2);
      expect(window[0]?.timestamp).toBe('2026-11-22T12:00');
      expect(window[1]?.timestamp).toBe('2026-11-22T13:00');
    });
  });

  describe('US EPA & European EEA AQI interpretation', () => {
    it('keeps US AQI (EPA) and European AQI (EEA) scales strictly separate and handles missing values honestly', () => {
      expect(interpretUsAqi(42).category).toBe('Good');
      expect(interpretUsAqi(78).category).toBe('Moderate');
      expect(interpretUsAqi(115).category).toBe('Unhealthy for Sensitive Groups');
      expect(interpretUsAqi(175).category).toBe('Unhealthy');
      expect(interpretUsAqi(245).category).toBe('Very Unhealthy');
      expect(interpretUsAqi(350).category).toBe('Hazardous');

      const missingUs = interpretUsAqi(null);
      expect(missingUs.status).toBe('unavailable');
      expect(missingUs.value).toBeNull();

      expect(interpretEuropeanAqi(15).category).toBe('Good');
      expect(interpretEuropeanAqi(32).category).toBe('Fair');
      expect(interpretEuropeanAqi(55).category).toBe('Moderate');
      expect(interpretEuropeanAqi(72).category).toBe('Poor');
      expect(interpretEuropeanAqi(94).category).toBe('Very poor');
      expect(interpretEuropeanAqi(120).category).toBe('Extremely poor');

      const missingEu = interpretEuropeanAqi(null);
      expect(missingEu.status).toBe('unavailable');
      expect(missingEu.value).toBeNull();
    });

    it('uses updated 2024 US EPA PM2.5 breakpoints and identifies dominant pollutant without averaging concentrations', () => {
      expect(computeEpaPollutantSubIndex('pm2_5', 9.0)).toBe(50);
      expect(computeEpaPollutantSubIndex('pm2_5', 9.1)).toBe(51);

      const snapshot = mapOpenMeteoResponseToSnapshot(
        SAMPLE_RAW_RESPONSE,
        '2026-11-22T12:05:00.000Z',
      );
      const dominant = identifyDominantPollutant(snapshot.current);
      expect(dominant.status).toBe('available');
      expect(dominant.code).toBe('pm2_5');
      expect(dominant.abbreviation).toBe('PM2.5');
      expect(dominant.basis).toBe('provider_sub_index');
    });

    it('falls back to EPA breakpoint estimation when provider sub-indices are omitted and returns unavailable when all pollutants are null', () => {
      const noSubIndices = mapOpenMeteoResponseToSnapshot(
        {
          latitude: 50,
          longitude: 19,
          current: {
            time: '2026-11-22T12:00',
            pm2_5: 5.0,
            pm10: 145.0,
            nitrogen_dioxide: 20.0,
          },
        },
        '2026-11-22T12:00:00Z',
      );
      const dominant = identifyDominantPollutant(noSubIndices.current);
      expect(dominant.code).toBe('pm10');
      expect(dominant.basis).toBe('epa_breakpoint_estimate');

      const empty = mapOpenMeteoResponseToSnapshot(
        { latitude: 50, longitude: 19 },
        '2026-11-22T12:00:00Z',
      );
      expect(identifyDominantPollutant(empty.current).status).toBe('unavailable');
    });
  });

  describe('Pollutant interpreter, data freshness & caching', () => {
    it('interprets all 6 core pollutants and distinguishes concentration bands from AQI', () => {
      const snapshot = mapOpenMeteoResponseToSnapshot(
        {
          latitude: 50,
          longitude: 19,
          current: {
            time: '2026-11-22T12:00',
            pm2_5: 38.4,
            pm10: null,
            nitrogen_dioxide: 120,
            sulphur_dioxide: 10,
            carbon_monoxide: 500,
            ozone: 195,
          },
        },
        '2026-11-22T12:00:00Z',
      );
      const details = interpretPollutants(snapshot.current);
      expect(details).toHaveLength(6);
      const pm10 = details.find((p) => p.code === 'pm10');
      expect(pm10?.status).toBe('unavailable');
      expect(pm10?.concentration).toBeNull();
      const o3 = details.find((p) => p.code === 'o3');
      expect(o3?.concentrationBand).toBe('high');
      expect(o3?.distinctionNote).toContain('mass per cubic meter');
    });

    it('evaluates fresh, stale, and unavailable transparency metadata accurately', () => {
      const fresh = evaluateFreshnessStatus({
        isStaleFallback: false,
        hasValidData: true,
        availabilityStatus: 'available',
        observationTimestamp: '2026-11-22T12:00',
        fetchedAt: '2026-11-22T12:01:00Z',
        cacheAgeSeconds: 10,
        fallbackReason: null,
      });
      expect(fresh.freshnessStatus).toBe('fresh');
      expect(fresh.dataNature).toBe('model_forecast');
      expect(fresh.transparency.dataNatureDisclosure).toContain('not direct ground-station');

      const stale = evaluateFreshnessStatus({
        isStaleFallback: true,
        hasValidData: true,
        availabilityStatus: 'available',
        observationTimestamp: '2026-11-22T10:00',
        fetchedAt: '2026-11-22T10:01:00Z',
        cacheAgeSeconds: 7200,
        fallbackReason: 'Upstream timeout',
      });
      expect(stale.freshnessStatus).toBe('stale');
      expect(stale.transparency.fallbackActive).toBe(true);

      const unavailable = evaluateFreshnessStatus({
        isStaleFallback: false,
        hasValidData: false,
        availabilityStatus: 'unavailable',
        observationTimestamp: null,
        fetchedAt: '2026-11-22T12:01:00Z',
        cacheAgeSeconds: null,
        fallbackReason: 'Service offline',
      });
      expect(unavailable.freshnessStatus).toBe('unavailable');
      expect(unavailable.dataNature).toBe('unavailable');
    });

    it('normalizes cache keys, respects fresh/stale TTL boundaries, and coalesces concurrent fetches', async () => {
      let currentTimeMs = 1_000_000;
      const repo = new AirQualityCacheRepository({
        cacheTtlMs: 60_000,
        staleTtlMs: 300_000,
        geocodeTtlMs: 600_000,
        nowMs: () => currentTimeMs,
      });

      const keyA = buildAirQualityCacheKey({
        latitude: 50.06141,
        longitude: 19.93691,
        forecastDays: 2,
      });
      const keyB = buildAirQualityCacheKey({
        latitude: 50.06144,
        longitude: 19.93689,
        forecastDays: 2,
      });
      expect(keyA).toBe(keyB);

      const snapshot = mapOpenMeteoResponseToSnapshot(SAMPLE_RAW_RESPONSE, '2026-11-22T12:00:00Z');
      repo.setAirQuality(keyA, snapshot);
      expect(repo.getFreshAirQuality(keyA)).not.toBeNull();

      // Advance past fresh TTL (60s) but within stale TTL (300s)
      currentTimeMs += 120_000;
      expect(repo.getFreshAirQuality(keyA)).toBeNull();
      const stale = repo.getStaleAirQualityFallback(keyA);
      expect(stale).not.toBeNull();
      expect(stale?.cacheAgeSeconds).toBe(120);

      // Advance past stale TTL (300s)
      currentTimeMs += 250_000;
      expect(repo.getStaleAirQualityFallback(keyA)).toBeNull();

      // In-flight coalescing invokes fetcher only once
      let calls = 0;
      const fetcher = async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return snapshot;
      };
      await Promise.all([
        repo.coalesceAirQualityFetch(keyA, fetcher),
        repo.coalesceAirQualityFetch(keyA, fetcher),
      ]);
      expect(calls).toBe(1);
    });
  });

  describe('Winter smog guidance engine', () => {
    it('distinguishes cold weather or fog from particulate smog and handles unavailable readings proportionally', () => {
      const unavailableGuidance = buildWinterSmogGuidance({
        usAqi: interpretUsAqi(null),
        europeanAqi: interpretEuropeanAqi(null),
        dominantPollutant: {
          status: 'unavailable',
          code: null,
          abbreviation: null,
          fullName: null,
          basis: 'unavailable',
          estimatedSubIndex: null,
          explanation: 'Unavailable',
        },
        isStale: false,
      });
      expect(unavailableGuidance.status).toBe('general_precaution');
      expect(unavailableGuidance.fogDistinctionNote).toContain('water-vapor fog');
      expect(unavailableGuidance.actions.length).toBeGreaterThanOrEqual(3);

      const highGuidance = buildWinterSmogGuidance({
        usAqi: interpretUsAqi(168),
        europeanAqi: interpretEuropeanAqi(82),
        dominantPollutant: {
          status: 'available',
          code: 'pm2_5',
          abbreviation: 'PM2.5',
          fullName: 'Fine Particulate Matter',
          basis: 'provider_sub_index',
          estimatedSubIndex: 168,
          explanation: 'PM2.5 is leading.',
        },
        isStale: false,
      });
      expect(highGuidance.status).toBe('measured_evidence');
      expect(highGuidance.headline).toContain('Elevated Smog Alert');
    });
  });
});
