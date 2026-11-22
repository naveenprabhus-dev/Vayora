import { z } from 'zod';
import { boundedStringSchema } from './common.schema.ts';
import { LOCATION_ZONE_TYPES, PROFILE_FIELD_LIMITS } from './profile.schema.ts';

export const POLLUTANT_CODES = ['pm2_5', 'pm10', 'no2', 'so2', 'co', 'o3'] as const;
export const AQI_SCALES = ['us_aqi', 'european_aqi'] as const;
export const DATA_FRESHNESS_STATES = ['fresh', 'stale', 'unavailable'] as const;
export const DATA_AVAILABILITY_STATES = ['available', 'partial', 'unavailable'] as const;
export const DATA_NATURE_TYPES = ['model_forecast', 'ground_observation', 'unavailable'] as const;
export const POLLUTION_LEVEL_BANDS = [
  'low',
  'moderate',
  'high',
  'very_high',
  'unavailable',
] as const;

export const coordinatesSchema = z.object({
  latitude: z.number().finite().min(-90, 'Latitude must be between -90 and 90.').max(90),
  longitude: z.number().finite().min(-180, 'Longitude must be between -180 and 180.').max(180),
});

const strictNumericQuerySchema = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^-?\d+(?:\.\d+)?$/, `${label} must be a valid decimal number.`)
    .transform((raw) => Number(raw))
    .refine((val) => Number.isFinite(val) && val >= min && val <= max, {
      message: `${label} must be between ${min} and ${max}.`,
    });

export const airQualityQuerySchema = z
  .object({
    latitude: strictNumericQuerySchema(-90, 90, 'Latitude').optional(),
    longitude: strictNumericQuerySchema(-180, 180, 'Longitude').optional(),
    hours: z
      .string()
      .trim()
      .regex(/^\d+$/, 'Hours must be a positive integer.')
      .transform((raw) => Number(raw))
      .refine((val) => Number.isInteger(val) && val >= 1 && val <= 48, {
        message: 'Hours must be an integer between 1 and 48.',
      })
      .optional(),
    scale: z.enum(AQI_SCALES).optional(),
  })
  .strict()
  .refine(
    (data) =>
      (data.latitude === undefined && data.longitude === undefined) ||
      (data.latitude !== undefined && data.longitude !== undefined),
    {
      message: 'Both latitude and longitude must be provided together.',
      path: ['latitude'],
    },
  );

export const locationUpdateSchema = z
  .object({
    country: boundedStringSchema(2, PROFILE_FIELD_LIMITS.countryMaxLength, 'Country'),
    city: boundedStringSchema(2, PROFILE_FIELD_LIMITS.cityMaxLength, 'City'),
    neighborhood: boundedStringSchema(
      2,
      PROFILE_FIELD_LIMITS.neighborhoodMaxLength,
      'Neighborhood',
    ),
    postalPrefix: z
      .string()
      .trim()
      .min(2, 'Postal prefix must be at least 2 characters.')
      .max(
        PROFILE_FIELD_LIMITS.postalPrefixMaxLength,
        `Postal prefix must not exceed ${PROFILE_FIELD_LIMITS.postalPrefixMaxLength} characters.`,
      )
      .regex(/^[a-zA-Z0-9\-\s]+$/, 'Postal prefix contains invalid characters.'),
    primaryZoneType: z.enum(LOCATION_ZONE_TYPES).optional(),
  })
  .strict();

export type PollutantCode = (typeof POLLUTANT_CODES)[number];
export type AqiScaleId = (typeof AQI_SCALES)[number];
export type DataFreshnessStatus = (typeof DATA_FRESHNESS_STATES)[number];
export type DataAvailabilityStatus = (typeof DATA_AVAILABILITY_STATES)[number];
export type DataNature = (typeof DATA_NATURE_TYPES)[number];
export type PollutionLevelBand = (typeof POLLUTION_LEVEL_BANDS)[number];
export type Coordinates = z.infer<typeof coordinatesSchema>;
export type AirQualityQueryInput = z.infer<typeof airQualityQuerySchema>;
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>;
