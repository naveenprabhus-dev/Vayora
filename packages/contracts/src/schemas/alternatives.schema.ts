import { z } from 'zod';

export const ALTERNATIVE_CATEGORIES = [
  'transportation',
  'household_energy_heating',
  'everyday_activities',
  'consumption_waste',
] as const;

export const ALTERNATIVE_IMPACT_CLASSIFICATIONS = [
  'local_emissions',
  'personal_exposure',
  'both_exposure_and_emissions',
  'broader_sustainability',
] as const;

export const ALTERNATIVE_AFFORDABILITY_TIERS = [
  'zero_cost',
  'low_cost',
  'moderate_investment',
] as const;

export const ALTERNATIVE_RELEVANCE_SCOPES = ['indoor', 'outdoor', 'both'] as const;

export const ALTERNATIVE_SUITABILITY_STATUSES = [
  'recommended',
  'conditional',
  'not_advised_now',
] as const;

export const ALTERNATIVE_PRACTICALITY_FILTERS = ['all', 'recommended', 'conditional'] as const;

export const alternativesQuerySchema = z
  .object({
    category: z.enum(ALTERNATIVE_CATEGORIES).optional(),
    affordability: z.enum(ALTERNATIVE_AFFORDABILITY_TIERS).optional(),
    relevance: z.enum(ALTERNATIVE_RELEVANCE_SCOPES).optional(),
    impactType: z.enum(ALTERNATIVE_IMPACT_CLASSIFICATIONS).optional(),
    practicality: z.enum(['recommended', 'conditional']).optional(),
  })
  .strict();

export const alternativesCompareQuerySchema = z
  .object({
    alternativeId: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9-]+$/, 'Invalid alternative identifier format.'),
    currentOption: z.string().trim().min(2).max(80).optional(),
  })
  .strict();

export const alternativesRefreshBodySchema = z
  .object({
    forceRefresh: z.boolean().optional(),
    category: z.enum(ALTERNATIVE_CATEGORIES).optional(),
    affordability: z.enum(ALTERNATIVE_AFFORDABILITY_TIERS).optional(),
    relevance: z.enum(ALTERNATIVE_RELEVANCE_SCOPES).optional(),
    impactType: z.enum(ALTERNATIVE_IMPACT_CLASSIFICATIONS).optional(),
    practicality: z.enum(['recommended', 'conditional']).optional(),
  })
  .strict();

export type AlternativeCategory = (typeof ALTERNATIVE_CATEGORIES)[number];
export type AlternativeImpactClassification = (typeof ALTERNATIVE_IMPACT_CLASSIFICATIONS)[number];
export type AlternativeAffordabilityTier = (typeof ALTERNATIVE_AFFORDABILITY_TIERS)[number];
export type AlternativeRelevanceScope = (typeof ALTERNATIVE_RELEVANCE_SCOPES)[number];
export type AlternativeSuitabilityStatus = (typeof ALTERNATIVE_SUITABILITY_STATUSES)[number];
export type AlternativesQueryInput = z.infer<typeof alternativesQuerySchema>;
export type AlternativesCompareQueryInput = z.infer<typeof alternativesCompareQuerySchema>;
export type AlternativesRefreshInput = z.infer<typeof alternativesRefreshBodySchema>;
