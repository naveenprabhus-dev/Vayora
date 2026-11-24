import type {
  AirQualityCurrentResponse,
  AirQualityForecastResponse,
  AirQualityGuidanceResponse,
  AirQualityHealthResponse,
  AirQualityLocationSummary,
  AirQualityLocationUpdateResponse,
  AirQualityPollutantsResponse,
  AirQualityQueryInput,
  HourlyForecastPoint,
  LocationUpdateInput,
} from '@uaqa/contracts';
import type {
  HouseholdRepository,
  StoredHouseholdProfile,
} from '../../repositories/household.repository.ts';
import { NotFoundError, ValidationError } from '../../utils/errors.ts';
import { AIR_QUALITY_LIMITS, OPEN_METEO_PROVIDER_ID } from './air-quality.constants.ts';
import {
  determineSnapshotAvailability,
  mapOpenMeteoResponseToSnapshot,
  selectForecastWindow,
} from './air-quality.mapper.ts';
import {
  AirQualityCacheRepository,
  buildAirQualityCacheKey,
  buildGeocodeCacheKey,
} from './air-quality.repository.ts';
import { coordinatesSchema } from './air-quality.schemas.ts';
import type { NormalizedAirQualitySnapshot, NormalizedHourlySlot } from './air-quality.types.ts';
import type {
  AirQualityProvider,
  GeocodingProvider,
} from './providers/air-quality.provider.interface.ts';
import {
  identifyDominantPollutant,
  interpretEuropeanAqi,
  interpretUsAqi,
} from './utils/aqi-interpreter.ts';
import { evaluateFreshnessStatus } from './utils/data-freshness.ts';
import { interpretPollutants } from './utils/pollutant-interpreter.ts';
import { buildWinterSmogGuidance } from './utils/winter-smog-guidance.ts';

function toHourlyPoint(slot: NormalizedHourlySlot): HourlyForecastPoint {
  const values = [
    slot.usAqi,
    slot.europeanAqi,
    slot.pollutants.pm2_5,
    slot.pollutants.pm10,
    slot.pollutants.no2,
    slot.pollutants.so2,
    slot.pollutants.co,
    slot.pollutants.o3,
  ];
  const validCount = values.filter((val) => val !== null).length;
  const availability =
    validCount === 0 ? 'unavailable' : validCount === values.length ? 'available' : 'partial';

  return {
    timestamp: slot.timestamp,
    usAqi: slot.usAqi,
    europeanAqi: slot.europeanAqi,
    pm25: slot.pollutants.pm2_5,
    pm10: slot.pollutants.pm10,
    no2: slot.pollutants.no2,
    so2: slot.pollutants.so2,
    co: slot.pollutants.co,
    o3: slot.pollutants.o3,
    availability,
  };
}

function buildUnavailableSnapshot(
  latitude: number,
  longitude: number,
  timezone: string,
  fetchedAtIso: string,
): NormalizedAirQualitySnapshot {
  return {
    providerId: OPEN_METEO_PROVIDER_ID,
    latitude,
    longitude,
    timezone,
    fetchedAt: fetchedAtIso,
    current: {
      observationTimestamp: null,
      usAqi: null,
      europeanAqi: null,
      usAqiSubIndices: {},
      pollutants: {
        pm2_5: null,
        pm10: null,
        no2: null,
        so2: null,
        co: null,
        o3: null,
      },
      units: {
        pm2_5: 'µg/m³',
        pm10: 'µg/m³',
        no2: 'µg/m³',
        so2: 'µg/m³',
        co: 'µg/m³',
        o3: 'µg/m³',
      },
    },
    hourly: [],
    unitLabels: {
      usAqi: 'US AQI',
      europeanAqi: 'EAQI',
      pollutants: 'µg/m³',
    },
  };
}

export interface AirQualityServiceDependencies {
  readonly airQualityProvider: AirQualityProvider;
  readonly geocodingProvider: GeocodingProvider;
  readonly householdRepository: HouseholdRepository;
  readonly cacheRepository: AirQualityCacheRepository;
  readonly cacheTtlSeconds: number;
  readonly staleTtlSeconds: number;
  readonly onHouseholdUpdated?: (ownerUid: string) => void;
}

export class AirQualityService {
  private readonly deps: AirQualityServiceDependencies;

  public constructor(deps: AirQualityServiceDependencies) {
    this.deps = deps;
  }

  private async resolveLocationForOwner(
    ownerUid: string,
    query: AirQualityQueryInput,
  ): Promise<{
    readonly location: AirQualityLocationSummary;
    readonly householdProfile: StoredHouseholdProfile | null;
  }> {
    const profile = await this.deps.householdRepository.findByOwnerUid(ownerUid);

    if (query.latitude !== undefined && query.longitude !== undefined) {
      const coords = coordinatesSchema.parse({
        latitude: query.latitude,
        longitude: query.longitude,
      });
      return {
        householdProfile: profile,
        location: {
          city: profile?.city ?? 'Selected Coordinates',
          neighborhood: profile?.neighborhood ?? 'Coordinate Selection',
          country: profile?.country ?? 'Custom',
          postalPrefix: profile?.postalPrefix ?? '',
          resolvedLabel: profile
            ? `${profile.city}, ${profile.country}`
            : `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          timezone: 'UTC',
          resolutionSource: 'explicit_coordinates',
        },
      };
    }

    if (!profile) {
      throw new NotFoundError(
        'Save a household location in onboarding before requesting local air quality intelligence.',
      );
    }

    const geocoded = await this.geocodeWithCache({
      country: profile.country,
      city: profile.city,
      neighborhood: profile.neighborhood,
      postalPrefix: profile.postalPrefix,
    });

    if (!geocoded) {
      throw new ValidationError(
        'Location could not be resolved to supported coordinates. Check your saved city and country spelling.',
        [
          {
            field: 'city',
            message: `No supported coordinates were found for ${profile.city}, ${profile.country}.`,
          },
        ],
      );
    }

    const validatedCoords = coordinatesSchema.parse({
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
    });

    return {
      householdProfile: profile,
      location: {
        city: profile.city,
        neighborhood: profile.neighborhood,
        country: profile.country,
        postalPrefix: profile.postalPrefix,
        resolvedLabel: geocoded.resolvedLabel || `${profile.city}, ${profile.country}`,
        latitude: validatedCoords.latitude,
        longitude: validatedCoords.longitude,
        timezone: geocoded.timezone,
        resolutionSource: 'saved_profile_geocoded',
      },
    };
  }

  private async geocodeWithCache(input: {
    readonly country: string;
    readonly city: string;
    readonly neighborhood?: string;
    readonly postalPrefix?: string;
  }) {
    const cacheKey = buildGeocodeCacheKey(input);
    const cached = this.deps.cacheRepository.getCachedGeocode(cacheKey);
    if (cached) {
      return cached.value;
    }

    const resolved = await this.deps.cacheRepository.coalesceGeocodeLookup(cacheKey, async () => {
      const result = await this.deps.geocodingProvider.geocodeLocation(input);
      this.deps.cacheRepository.setCachedGeocode(cacheKey, result);
      return result;
    });

    return resolved;
  }

  private async resolveAirQualitySnapshot(location: AirQualityLocationSummary): Promise<{
    readonly snapshot: NormalizedAirQualitySnapshot;
    readonly isStaleFallback: boolean;
    readonly hasValidData: boolean;
    readonly cacheAgeSeconds: number | null;
    readonly fallbackReason: string | null;
  }> {
    const forecastDays = AIR_QUALITY_LIMITS.maxForecastDays;
    const cacheKey = buildAirQualityCacheKey({
      latitude: location.latitude,
      longitude: location.longitude,
      forecastDays,
    });

    const freshEntry = this.deps.cacheRepository.getFreshAirQuality(cacheKey);
    if (freshEntry) {
      const ageSeconds = Math.max(0, Math.round((Date.now() - freshEntry.cachedAtMs) / 1000));
      return {
        snapshot: freshEntry.snapshot,
        isStaleFallback: false,
        hasValidData: true,
        cacheAgeSeconds: ageSeconds,
        fallbackReason: null,
      };
    }

    try {
      const liveSnapshot = await this.deps.cacheRepository.coalesceAirQualityFetch(
        cacheKey,
        async () => {
          const raw = await this.deps.airQualityProvider.fetchAirQuality({
            latitude: location.latitude,
            longitude: location.longitude,
            forecastDays,
          });
          const mapped = mapOpenMeteoResponseToSnapshot(raw, new Date().toISOString());
          this.deps.cacheRepository.setAirQuality(cacheKey, mapped);
          return mapped;
        },
      );

      const availability = determineSnapshotAvailability(
        liveSnapshot.current.pollutants,
        liveSnapshot.current.usAqi,
        liveSnapshot.current.europeanAqi,
      );

      return {
        snapshot: liveSnapshot,
        isStaleFallback: false,
        hasValidData: availability !== 'unavailable',
        cacheAgeSeconds: 0,
        fallbackReason:
          availability === 'unavailable'
            ? 'Upstream provider returned no valid pollutant or AQI values for this location.'
            : null,
      };
    } catch (error) {
      const fallbackReason =
        error instanceof Error ? error.message : 'Live air quality provider could not be reached.';

      const staleFallback = this.deps.cacheRepository.getStaleAirQualityFallback(cacheKey);
      if (staleFallback) {
        return {
          snapshot: staleFallback.entry.snapshot,
          isStaleFallback: true,
          hasValidData: true,
          cacheAgeSeconds: staleFallback.cacheAgeSeconds,
          fallbackReason: `Displaying cached readings because live retrieval failed: ${fallbackReason}`,
        };
      }

      return {
        snapshot: buildUnavailableSnapshot(
          location.latitude,
          location.longitude,
          location.timezone,
          new Date().toISOString(),
        ),
        isStaleFallback: false,
        hasValidData: false,
        cacheAgeSeconds: null,
        fallbackReason,
      };
    }
  }

  public async getCurrentAirQuality(
    ownerUid: string,
    query: AirQualityQueryInput,
  ): Promise<AirQualityCurrentResponse> {
    const { location, householdProfile } = await this.resolveLocationForOwner(ownerUid, query);
    const resolved = await this.resolveAirQualitySnapshot(location);
    const { snapshot } = resolved;

    const locationWithTimezone: AirQualityLocationSummary = {
      ...location,
      timezone: snapshot.timezone || location.timezone,
    };

    const availabilityStatus = resolved.hasValidData
      ? determineSnapshotAvailability(
          snapshot.current.pollutants,
          snapshot.current.usAqi,
          snapshot.current.europeanAqi,
        )
      : 'unavailable';

    const { transparency } = evaluateFreshnessStatus({
      isStaleFallback: resolved.isStaleFallback,
      hasValidData: resolved.hasValidData,
      availabilityStatus,
      observationTimestamp: snapshot.current.observationTimestamp,
      fetchedAt: snapshot.fetchedAt,
      cacheAgeSeconds: resolved.cacheAgeSeconds,
      fallbackReason: resolved.fallbackReason,
    });

    const usAqi = interpretUsAqi(snapshot.current.usAqi);
    const europeanAqi = interpretEuropeanAqi(snapshot.current.europeanAqi);
    const dominantPollutant = identifyDominantPollutant(snapshot.current);
    const pollutants = interpretPollutants(snapshot.current);
    const forecastWindow = selectForecastWindow(
      snapshot.hourly,
      snapshot.current.observationTimestamp,
      query.hours ?? AIR_QUALITY_LIMITS.defaultForecastHours,
    ).map(toHourlyPoint);
    const guidance = buildWinterSmogGuidance({
      usAqi,
      europeanAqi,
      dominantPollutant,
      isStale: resolved.isStaleFallback,
      householdProfile,
    });

    return {
      location: locationWithTimezone,
      aqi: {
        usAqi,
        europeanAqi,
        dominantPollutant,
      },
      pollutants,
      forecastPreview: forecastWindow,
      guidance,
      transparency,
    };
  }

  public async getForecast(
    ownerUid: string,
    query: AirQualityQueryInput,
  ): Promise<AirQualityForecastResponse> {
    const horizonHours = query.hours ?? AIR_QUALITY_LIMITS.defaultForecastHours;
    const { location } = await this.resolveLocationForOwner(ownerUid, query);
    const resolved = await this.resolveAirQualitySnapshot(location);
    const { snapshot } = resolved;

    const hourly = selectForecastWindow(
      snapshot.hourly,
      snapshot.current.observationTimestamp,
      horizonHours,
    ).map(toHourlyPoint);

    const hasHourlyData = hourly.some((slot) => slot.availability !== 'unavailable');
    const availabilityStatus = !hasHourlyData
      ? 'unavailable'
      : hourly.every((slot) => slot.availability === 'available')
        ? 'available'
        : 'partial';

    const { dataNature, transparency } = evaluateFreshnessStatus({
      isStaleFallback: resolved.isStaleFallback,
      hasValidData: resolved.hasValidData && hasHourlyData,
      availabilityStatus,
      observationTimestamp: snapshot.current.observationTimestamp,
      fetchedAt: snapshot.fetchedAt,
      cacheAgeSeconds: resolved.cacheAgeSeconds,
      fallbackReason: resolved.fallbackReason,
    });

    return {
      location: {
        ...location,
        timezone: snapshot.timezone || location.timezone,
      },
      horizonHours,
      dataNature,
      units: snapshot.unitLabels,
      hourly,
      transparency,
    };
  }

  public async getPollutants(
    ownerUid: string,
    query: AirQualityQueryInput,
  ): Promise<AirQualityPollutantsResponse> {
    const { location } = await this.resolveLocationForOwner(ownerUid, query);
    const resolved = await this.resolveAirQualitySnapshot(location);
    const { snapshot } = resolved;

    const availabilityStatus = resolved.hasValidData
      ? determineSnapshotAvailability(
          snapshot.current.pollutants,
          snapshot.current.usAqi,
          snapshot.current.europeanAqi,
        )
      : 'unavailable';

    const { transparency } = evaluateFreshnessStatus({
      isStaleFallback: resolved.isStaleFallback,
      hasValidData: resolved.hasValidData,
      availabilityStatus,
      observationTimestamp: snapshot.current.observationTimestamp,
      fetchedAt: snapshot.fetchedAt,
      cacheAgeSeconds: resolved.cacheAgeSeconds,
      fallbackReason: resolved.fallbackReason,
    });

    return {
      location: {
        ...location,
        timezone: snapshot.timezone || location.timezone,
      },
      pollutants: interpretPollutants(snapshot.current),
      dominantPollutant: identifyDominantPollutant(snapshot.current),
      transparency,
    };
  }

  public async getGuidance(
    ownerUid: string,
    query: AirQualityQueryInput,
  ): Promise<AirQualityGuidanceResponse> {
    const { location, householdProfile } = await this.resolveLocationForOwner(ownerUid, query);
    const resolved = await this.resolveAirQualitySnapshot(location);
    const { snapshot } = resolved;

    const availabilityStatus = resolved.hasValidData
      ? determineSnapshotAvailability(
          snapshot.current.pollutants,
          snapshot.current.usAqi,
          snapshot.current.europeanAqi,
        )
      : 'unavailable';

    const { transparency } = evaluateFreshnessStatus({
      isStaleFallback: resolved.isStaleFallback,
      hasValidData: resolved.hasValidData,
      availabilityStatus,
      observationTimestamp: snapshot.current.observationTimestamp,
      fetchedAt: snapshot.fetchedAt,
      cacheAgeSeconds: resolved.cacheAgeSeconds,
      fallbackReason: resolved.fallbackReason,
    });

    const usAqi = interpretUsAqi(snapshot.current.usAqi);
    const europeanAqi = interpretEuropeanAqi(snapshot.current.europeanAqi);
    const dominantPollutant = identifyDominantPollutant(snapshot.current);

    return {
      location: {
        ...location,
        timezone: snapshot.timezone || location.timezone,
      },
      guidance: buildWinterSmogGuidance({
        usAqi,
        europeanAqi,
        dominantPollutant,
        isStale: resolved.isStaleFallback,
        householdProfile,
      }),
      transparency,
    };
  }

  public async updateHouseholdLocation(
    ownerUid: string,
    input: LocationUpdateInput,
  ): Promise<AirQualityLocationUpdateResponse> {
    const existing = await this.deps.householdRepository.findByOwnerUid(ownerUid);
    if (!existing) {
      throw new NotFoundError(
        'Complete household onboarding before updating air quality location.',
      );
    }

    const geocoded = await this.geocodeWithCache({
      country: input.country,
      city: input.city,
      neighborhood: input.neighborhood,
      postalPrefix: input.postalPrefix,
    });

    if (!geocoded) {
      throw new ValidationError(
        'Location could not be resolved to supported coordinates. Check city and country spelling.',
        [
          {
            field: 'city',
            message: `No supported coordinates were found for ${input.city}, ${input.country}.`,
          },
        ],
      );
    }

    const validatedCoords = coordinatesSchema.parse({
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
    });

    const updatedProfile = await this.deps.householdRepository.upsertForOwner(ownerUid, {
      country: input.country,
      city: input.city,
      neighborhood: input.neighborhood,
      postalPrefix: input.postalPrefix,
      locationPreferences: {
        primaryZoneType: input.primaryZoneType ?? existing.locationPreferences.primaryZoneType,
        alertsEnabled: existing.locationPreferences.alertsEnabled,
      },
      householdSize: existing.householdSize,
      householdComposition: [...existing.householdComposition],
      primaryCommuteMode: existing.primaryCommuteMode,
      outdoorActivityPattern: existing.outdoorActivityPattern,
      ventilationContext: existing.ventilationContext,
      hasIndoorAirPurifier: existing.hasIndoorAirPurifier,
      heatingType: existing.heatingType,
      lifestylePreferences: existing.lifestylePreferences,
      onboardingCompleted: existing.onboardingCompleted,
    });

    this.deps.onHouseholdUpdated?.(ownerUid);

    return {
      location: {
        city: updatedProfile.city,
        neighborhood: updatedProfile.neighborhood,
        country: updatedProfile.country,
        postalPrefix: updatedProfile.postalPrefix,
        resolvedLabel:
          geocoded.resolvedLabel || `${updatedProfile.city}, ${updatedProfile.country}`,
        latitude: validatedCoords.latitude,
        longitude: validatedCoords.longitude,
        timezone: geocoded.timezone,
        resolutionSource: 'saved_profile_geocoded',
      },
      updatedAt: updatedProfile.updatedAt,
    };
  }

  public async getHealthStatus(): Promise<AirQualityHealthResponse> {
    const providerReachable = await this.deps.airQualityProvider.checkAvailability();
    const metrics = this.deps.cacheRepository.getCacheMetrics();

    return {
      status: providerReachable ? 'ok' : 'degraded',
      provider: OPEN_METEO_PROVIDER_ID,
      providerReachable,
      airQualityCacheEntries: metrics.airQualityCacheEntries,
      geocodingCacheEntries: metrics.geocodingCacheEntries,
      cacheTtlSeconds: this.deps.cacheTtlSeconds,
      staleTtlSeconds: this.deps.staleTtlSeconds,
      checkedAt: new Date().toISOString(),
    };
  }
}
