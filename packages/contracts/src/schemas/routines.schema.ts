import { z } from 'zod';
import { COMMUTE_MODES, OUTDOOR_ACTIVITY_PATTERNS } from './profile.schema.ts';

export const ROUTINE_TIME_PERIODS = ['morning', 'midday', 'evening', 'night'] as const;
export const ROUTINE_IMPACT_TYPES = ['exposure_reduction', 'emission_reduction', 'both'] as const;
export const ROUTINE_ACTION_STATUSES = ['recommended', 'optional', 'unavailable'] as const;
export const ROUTINE_CATEGORIES = [
  'commute',
  'outdoor_activity',
  'errands',
  'household_energy',
  'scheduling',
] as const;
export const INFORMATION_BASES = [
  'model_derived',
  'rule_derived',
  'qualitative_estimate',
  'unavailable',
] as const;

export const routinesQuerySchema = z
  .object({
    date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD.')
      .optional(),
    commuteMode: z.enum(COMMUTE_MODES).optional(),
    outdoorActivityPattern: z.enum(OUTDOOR_ACTIVITY_PATTERNS).optional(),
  })
  .strict();

export const routinesRefreshBodySchema = z
  .object({
    forceRefresh: z.boolean().optional(),
    commuteMode: z.enum(COMMUTE_MODES).optional(),
    outdoorActivityPattern: z.enum(OUTDOOR_ACTIVITY_PATTERNS).optional(),
  })
  .strict();

export type RoutineTimePeriod = (typeof ROUTINE_TIME_PERIODS)[number];
export type RoutineImpactType = (typeof ROUTINE_IMPACT_TYPES)[number];
export type RoutineActionStatus = (typeof ROUTINE_ACTION_STATUSES)[number];
export type RoutineCategory = (typeof ROUTINE_CATEGORIES)[number];
export type InformationBasis = (typeof INFORMATION_BASES)[number];
export type RoutinesQueryInput = z.infer<typeof routinesQuerySchema>;
export type RoutinesRefreshInput = z.infer<typeof routinesRefreshBodySchema>;
