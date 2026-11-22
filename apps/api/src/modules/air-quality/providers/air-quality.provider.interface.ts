import type { GeocodedCoordinateResult } from '../air-quality.types.ts';
import type { RawOpenMeteoAirQualityResponse } from '../air-quality.schemas.ts';

export interface AirQualityFetchParams {
  readonly latitude: number;
  readonly longitude: number;
  readonly forecastDays?: number;
}

export interface GeocodeLookupInput {
  readonly city: string;
  readonly country: string;
  readonly neighborhood?: string;
  readonly postalPrefix?: string;
}

export interface AirQualityProvider {
  readonly providerId: 'open-meteo';
  fetchAirQuality(params: AirQualityFetchParams): Promise<RawOpenMeteoAirQualityResponse>;
  checkAvailability(): Promise<boolean>;
}

export interface GeocodingProvider {
  geocodeLocation(input: GeocodeLookupInput): Promise<GeocodedCoordinateResult | null>;
}
