import {
  AIR_QUALITY_LIMITS,
  OPEN_METEO_CURRENT_VARIABLES,
  OPEN_METEO_HOURLY_VARIABLES,
} from './air-quality.constants.ts';
import type {
  AirQualityCacheEntry,
  GeocodeCacheEntry,
  GeocodedCoordinateResult,
  NormalizedAirQualitySnapshot,
} from './air-quality.types.ts';

const MAX_CACHE_ENTRIES = 500;

export function buildAirQualityCacheKey(params: {
  readonly latitude: number;
  readonly longitude: number;
  readonly forecastDays: number;
}): string {
  const digits = AIR_QUALITY_LIMITS.coordinateCachePrecisionDigits;
  const latKey = params.latitude.toFixed(digits);
  const lonKey = params.longitude.toFixed(digits);
  const variableSignature = [...OPEN_METEO_CURRENT_VARIABLES, ...OPEN_METEO_HOURLY_VARIABLES]
    .sort()
    .join(',');
  return `aq:${latKey}:${lonKey}:d${params.forecastDays}:${variableSignature}`;
}

export function buildGeocodeCacheKey(params: {
  readonly country: string;
  readonly city: string;
  readonly neighborhood?: string;
  readonly postalPrefix?: string;
}): string {
  const parts = [
    params.country.trim().toLowerCase(),
    params.city.trim().toLowerCase(),
    (params.neighborhood ?? '').trim().toLowerCase(),
    (params.postalPrefix ?? '').trim().toLowerCase(),
  ];
  return `geo:${parts.join('|')}`;
}

export function hasUsableAirQualityData(snapshot: NormalizedAirQualitySnapshot): boolean {
  const cur = snapshot.current;
  const hasCurrentAqi = cur.usAqi !== null || cur.europeanAqi !== null;
  const hasAnyPollutant = Object.values(cur.pollutants).some((val) => val !== null);
  const hasAnyHourly = snapshot.hourly.length > 0;
  return hasCurrentAqi || hasAnyPollutant || hasAnyHourly;
}

export class AirQualityCacheRepository {
  private readonly airQualityCache = new Map<string, AirQualityCacheEntry>();
  private readonly geocodeCache = new Map<string, GeocodeCacheEntry>();
  private readonly inflightAirQuality = new Map<string, Promise<NormalizedAirQualitySnapshot>>();
  private readonly inflightGeocode = new Map<string, Promise<GeocodedCoordinateResult | null>>();

  private readonly cacheTtlMs: number;
  private readonly staleTtlMs: number;
  private readonly geocodeTtlMs: number;
  private readonly nowMs: () => number;

  public constructor(options: {
    readonly cacheTtlMs: number;
    readonly staleTtlMs: number;
    readonly geocodeTtlMs: number;
    readonly nowMs?: () => number;
  }) {
    this.cacheTtlMs = options.cacheTtlMs;
    this.staleTtlMs = options.staleTtlMs;
    this.geocodeTtlMs = options.geocodeTtlMs;
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  public getFreshAirQuality(cacheKey: string): AirQualityCacheEntry | null {
    const entry = this.airQualityCache.get(cacheKey);
    if (!entry) {
      return null;
    }
    const ageMs = this.nowMs() - entry.cachedAtMs;
    if (ageMs <= this.cacheTtlMs && hasUsableAirQualityData(entry.snapshot)) {
      return entry;
    }
    return null;
  }

  public getStaleAirQualityFallback(cacheKey: string): {
    readonly entry: AirQualityCacheEntry;
    readonly cacheAgeSeconds: number;
  } | null {
    const entry = this.airQualityCache.get(cacheKey);
    if (!entry) {
      return null;
    }
    const ageMs = Math.max(0, this.nowMs() - entry.cachedAtMs);
    if (ageMs <= this.staleTtlMs && hasUsableAirQualityData(entry.snapshot)) {
      return {
        entry,
        cacheAgeSeconds: Math.round(ageMs / 1000),
      };
    }
    return null;
  }

  public setAirQuality(cacheKey: string, snapshot: NormalizedAirQualitySnapshot): void {
    if (!hasUsableAirQualityData(snapshot)) {
      return;
    }
    if (this.airQualityCache.size >= MAX_CACHE_ENTRIES && !this.airQualityCache.has(cacheKey)) {
      const oldestKey = this.airQualityCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.airQualityCache.delete(oldestKey);
      }
    }
    this.airQualityCache.set(cacheKey, {
      cacheKey,
      snapshot,
      cachedAtMs: this.nowMs(),
    });
  }

  public async coalesceAirQualityFetch(
    cacheKey: string,
    fetcher: () => Promise<NormalizedAirQualitySnapshot>,
  ): Promise<NormalizedAirQualitySnapshot> {
    const existing = this.inflightAirQuality.get(cacheKey);
    if (existing) {
      return existing;
    }

    const promise = fetcher().finally(() => {
      this.inflightAirQuality.delete(cacheKey);
    });
    this.inflightAirQuality.set(cacheKey, promise);
    return promise;
  }

  public getCachedGeocode(cacheKey: string): GeocodeCacheEntry | null {
    const entry = this.geocodeCache.get(cacheKey);
    if (!entry) {
      return null;
    }
    const ageMs = this.nowMs() - entry.cachedAtMs;
    if (ageMs <= this.geocodeTtlMs) {
      return entry;
    }
    this.geocodeCache.delete(cacheKey);
    return null;
  }

  public setCachedGeocode(cacheKey: string, value: GeocodedCoordinateResult | null): void {
    if (this.geocodeCache.size >= MAX_CACHE_ENTRIES && !this.geocodeCache.has(cacheKey)) {
      const oldestKey = this.geocodeCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.geocodeCache.delete(oldestKey);
      }
    }
    this.geocodeCache.set(cacheKey, {
      cacheKey,
      value,
      cachedAtMs: this.nowMs(),
    });
  }

  public async coalesceGeocodeLookup(
    cacheKey: string,
    lookup: () => Promise<GeocodedCoordinateResult | null>,
  ): Promise<GeocodedCoordinateResult | null> {
    const existing = this.inflightGeocode.get(cacheKey);
    if (existing) {
      return existing;
    }

    const promise = lookup().finally(() => {
      this.inflightGeocode.delete(cacheKey);
    });
    this.inflightGeocode.set(cacheKey, promise);
    return promise;
  }

  public getCacheMetrics(): {
    readonly airQualityCacheEntries: number;
    readonly geocodingCacheEntries: number;
  } {
    return {
      airQualityCacheEntries: this.airQualityCache.size,
      geocodingCacheEntries: this.geocodeCache.size,
    };
  }
}
