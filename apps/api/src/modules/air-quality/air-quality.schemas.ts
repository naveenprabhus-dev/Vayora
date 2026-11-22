import { z } from 'zod';
import { airQualityQuerySchema, coordinatesSchema, locationUpdateSchema } from '@uaqa/contracts';

export { airQualityQuerySchema, coordinatesSchema, locationUpdateSchema };

const optionalNumericField = z.union([z.number(), z.null()]).optional();
const optionalNumericSeries = z.array(z.union([z.number(), z.null()])).optional();

export const rawOpenMeteoAirQualityResponseSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  timezone: z.string().min(1).max(100).optional(),
  current_units: z
    .object({
      us_aqi: z.string().optional(),
      european_aqi: z.string().optional(),
      pm2_5: z.string().optional(),
      pm10: z.string().optional(),
      nitrogen_dioxide: z.string().optional(),
      sulphur_dioxide: z.string().optional(),
      carbon_monoxide: z.string().optional(),
      ozone: z.string().optional(),
    })
    .optional(),
  current: z
    .object({
      time: z.string().min(1).optional(),
      us_aqi: optionalNumericField,
      european_aqi: optionalNumericField,
      pm2_5: optionalNumericField,
      pm10: optionalNumericField,
      nitrogen_dioxide: optionalNumericField,
      sulphur_dioxide: optionalNumericField,
      carbon_monoxide: optionalNumericField,
      ozone: optionalNumericField,
      us_aqi_pm2_5: optionalNumericField,
      us_aqi_pm10: optionalNumericField,
      us_aqi_nitrogen_dioxide: optionalNumericField,
      us_aqi_sulphur_dioxide: optionalNumericField,
      us_aqi_carbon_monoxide: optionalNumericField,
      us_aqi_ozone: optionalNumericField,
    })
    .optional(),
  hourly_units: z
    .object({
      us_aqi: z.string().optional(),
      european_aqi: z.string().optional(),
      pm2_5: z.string().optional(),
    })
    .optional(),
  hourly: z
    .object({
      time: z.array(z.string().min(1)).max(240),
      us_aqi: optionalNumericSeries,
      european_aqi: optionalNumericSeries,
      pm2_5: optionalNumericSeries,
      pm10: optionalNumericSeries,
      nitrogen_dioxide: optionalNumericSeries,
      sulphur_dioxide: optionalNumericSeries,
      carbon_monoxide: optionalNumericSeries,
      ozone: optionalNumericSeries,
    })
    .optional(),
});

export const rawOpenMeteoGeocodingCandidateSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  country: z.string().optional(),
  country_code: z.string().optional(),
  admin1: z.string().optional(),
  timezone: z.string().optional(),
  postcodes: z.array(z.string()).optional(),
});

export const rawOpenMeteoGeocodingResponseSchema = z.object({
  results: z.array(rawOpenMeteoGeocodingCandidateSchema).optional(),
});

export type RawOpenMeteoAirQualityResponse = z.infer<typeof rawOpenMeteoAirQualityResponseSchema>;
export type RawOpenMeteoGeocodingCandidate = z.infer<typeof rawOpenMeteoGeocodingCandidateSchema>;
export type RawOpenMeteoGeocodingResponse = z.infer<typeof rawOpenMeteoGeocodingResponseSchema>;
