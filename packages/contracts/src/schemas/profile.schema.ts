import { z } from 'zod';
import { boundedStringSchema, firestoreIdSchema } from './common.schema.ts';

export const HEATING_TYPES = [
  'electric',
  'heat_pump',
  'natural_gas',
  'solid_fuel',
  'district',
] as const;

export const COMMUTE_MODES = [
  'walking',
  'cycling',
  'public_transit',
  'ev',
  'carpool',
  'gas_vehicle',
] as const;

export const HOUSEHOLD_COMPOSITION_GROUPS = [
  'adults',
  'young_children',
  'school_age_children',
  'older_adults',
  'pets',
] as const;

export const LOCATION_ZONE_TYPES = [
  'urban_core',
  'suburban_residential',
  'industrial_adjacent',
  'valley_basin',
] as const;

export const OUTDOOR_ACTIVITY_PATTERNS = [
  'mostly_indoors',
  'morning_commute',
  'evening_exercise',
  'school_run_family',
  'extended_outdoor',
] as const;

export const VENTILATION_CONTEXTS = [
  'natural_windows',
  'mechanical_hvac',
  'filtered_hvac_merv13',
  'portable_hepa_only',
] as const;

export const GUIDANCE_FOCUS_PREFERENCES = [
  'balanced',
  'commute_exposure',
  'indoor_air',
  'low_emission_habits',
] as const;

export const REMINDER_CADENCES = ['daily_smog_alerts', 'high_aqi_only', 'weekly_summary'] as const;

export const PROFILE_FIELD_LIMITS = {
  countryMaxLength: 80,
  cityMaxLength: 100,
  neighborhoodMaxLength: 120,
  postalPrefixMaxLength: 16,
  maxHouseholdSize: 20,
  maxCompositionGroups: 5,
} as const;

export const locationPreferencesSchema = z.object({
  primaryZoneType: z.enum(LOCATION_ZONE_TYPES),
  alertsEnabled: z.boolean(),
});

export const lifestylePreferencesSchema = z.object({
  preferredGuidanceFocus: z.enum(GUIDANCE_FOCUS_PREFERENCES),
  reminderCadence: z.enum(REMINDER_CADENCES),
});

export const householdLifestyleInputSchema = z.object({
  country: boundedStringSchema(2, PROFILE_FIELD_LIMITS.countryMaxLength, 'Country'),
  city: boundedStringSchema(2, PROFILE_FIELD_LIMITS.cityMaxLength, 'City'),
  neighborhood: boundedStringSchema(2, PROFILE_FIELD_LIMITS.neighborhoodMaxLength, 'Neighborhood'),
  postalPrefix: z
    .string()
    .trim()
    .min(2, 'Postal prefix must be at least 2 characters.')
    .max(
      PROFILE_FIELD_LIMITS.postalPrefixMaxLength,
      `Postal prefix must not exceed ${PROFILE_FIELD_LIMITS.postalPrefixMaxLength} characters.`,
    )
    .regex(/^[a-zA-Z0-9\-\s]+$/, 'Postal prefix contains invalid characters.'),
  locationPreferences: locationPreferencesSchema,
  householdSize: z.number().int().min(1).max(PROFILE_FIELD_LIMITS.maxHouseholdSize),
  householdComposition: z
    .array(z.enum(HOUSEHOLD_COMPOSITION_GROUPS))
    .min(1, 'Select at least one household composition group.')
    .max(PROFILE_FIELD_LIMITS.maxCompositionGroups),
  primaryCommuteMode: z.enum(COMMUTE_MODES),
  outdoorActivityPattern: z.enum(OUTDOOR_ACTIVITY_PATTERNS),
  ventilationContext: z.enum(VENTILATION_CONTEXTS),
  hasIndoorAirPurifier: z.boolean(),
  heatingType: z.enum(HEATING_TYPES),
  lifestylePreferences: lifestylePreferencesSchema,
  onboardingCompleted: z.boolean(),
});

export const householdLifestyleRecordSchema = householdLifestyleInputSchema.extend({
  ownerUid: firestoreIdSchema,
});

export type HouseholdLifestyleInput = z.infer<typeof householdLifestyleInputSchema>;
export type HouseholdLifestyleRecord = z.infer<typeof householdLifestyleRecordSchema>;
