import { z } from 'zod';

export const INDOOR_SCENARIO_IDS = [
  'baseline',
  'cooking',
  'cleaning',
  'opening_windows',
  'operating_purifier',
  'elevated_outdoor_pollution',
] as const;

export const INDOOR_VENTILATION_STATES = [
  'consider_ventilation',
  'shorter_timed_ventilation',
  'delay_optional_ventilation',
  'insufficient_data',
] as const;

export const INDOOR_INFORMATION_CATEGORIES = [
  'measured_indoor',
  'outdoor_air_quality',
  'estimated_inferred_indoor',
  'general_educational_guidance',
] as const;

export const INDOOR_ACTION_STATUSES = [
  'recommended',
  'optional',
  'caution',
  'not_applicable',
] as const;

export const INDOOR_POLLUTION_SOURCE_IDS = [
  'cooking_emissions',
  'tobacco_or_combustion_smoke',
  'incense_and_candles',
  'cleaning_products_and_aerosols',
  'poorly_maintained_combustion_appliances',
  'dust_and_resuspended_particles',
  'outdoor_infiltration',
] as const;

export const indoorGuidanceQuerySchema = z
  .object({
    scenario: z.enum(INDOOR_SCENARIO_IDS).optional(),
  })
  .strict();

export const indoorGuidanceRefreshBodySchema = z
  .object({
    forceRefresh: z.boolean().optional(),
    scenario: z.enum(INDOOR_SCENARIO_IDS).optional(),
  })
  .strict();

export type IndoorScenarioId = (typeof INDOOR_SCENARIO_IDS)[number];
export type IndoorVentilationState = (typeof INDOOR_VENTILATION_STATES)[number];
export type IndoorInformationCategory = (typeof INDOOR_INFORMATION_CATEGORIES)[number];
export type IndoorActionStatus = (typeof INDOOR_ACTION_STATUSES)[number];
export type IndoorPollutionSourceId = (typeof INDOOR_POLLUTION_SOURCE_IDS)[number];
export type IndoorGuidanceQueryInput = z.infer<typeof indoorGuidanceQuerySchema>;
export type IndoorGuidanceRefreshInput = z.infer<typeof indoorGuidanceRefreshBodySchema>;
