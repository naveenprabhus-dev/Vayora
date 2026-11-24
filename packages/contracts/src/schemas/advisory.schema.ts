import { z } from 'zod';
import { firestoreIdSchema } from './common.schema.ts';

export const ADVISORY_SOURCE_MODULES = ['routines', 'indoor', 'alternatives'] as const;
export const advisorySourceModuleSchema = z.enum(ADVISORY_SOURCE_MODULES);
export type AdvisorySourceModule = z.infer<typeof advisorySourceModuleSchema>;

export const ADVISORY_EXPLANATION_FOCUSES = [
  'balanced',
  'exposure',
  'emissions',
  'practicality',
  'limitations',
] as const;
export const advisoryExplanationFocusSchema = z.enum(ADVISORY_EXPLANATION_FOCUSES);
export type AdvisoryExplanationFocus = z.infer<typeof advisoryExplanationFocusSchema>;

export const ADVISORY_GENERATION_MODES = ['gemini', 'deterministic_fallback'] as const;
export const advisoryGenerationModeSchema = z.enum(ADVISORY_GENERATION_MODES);
export type AdvisoryGenerationMode = z.infer<typeof advisoryGenerationModeSchema>;

export const ADVISORY_IMPACT_CATEGORIES = [
  'personal_exposure',
  'local_emissions',
  'both',
  'indoor_filtration',
  'greenhouse_gas',
  'broader_sustainability',
] as const;
export const advisoryImpactCategorySchema = z.enum(ADVISORY_IMPACT_CATEGORIES);
export type AdvisoryImpactCategory = z.infer<typeof advisoryImpactCategorySchema>;

export const advisoryFreshnessDisclosureSchema = z.enum(['fresh', 'stale', 'unavailable']);
export type AdvisoryFreshnessDisclosure = z.infer<typeof advisoryFreshnessDisclosureSchema>;

const safeOptionTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Option identifier contains unsupported characters.');

export const advisoryBriefingQuerySchema = z
  .object({
    focus: advisoryExplanationFocusSchema.optional(),
    forceRefresh: z
      .union([z.literal('true'), z.literal('false'), z.boolean()])
      .transform((val) => val === true || val === 'true')
      .optional(),
  })
  .strict();

export type AdvisoryBriefingQueryInput = z.infer<typeof advisoryBriefingQuerySchema>;

export const advisoryExplainBodySchema = z
  .object({
    recommendationId: firestoreIdSchema,
    sourceModule: advisorySourceModuleSchema,
    focus: advisoryExplanationFocusSchema.optional(),
  })
  .strict();

export type AdvisoryExplainBodyInput = z.infer<typeof advisoryExplainBodySchema>;

export const advisoryCompareBodySchema = z
  .object({
    alternativeId: firestoreIdSchema,
    currentOption: safeOptionTextSchema.optional(),
    focus: advisoryExplanationFocusSchema.optional(),
  })
  .strict();

export type AdvisoryCompareBodyInput = z.infer<typeof advisoryCompareBodySchema>;

export const advisoryRefreshBodySchema = z
  .object({
    focus: advisoryExplanationFocusSchema.optional(),
    forceRefresh: z.boolean().default(true),
  })
  .strict();

export type AdvisoryRefreshBodyInput = z.infer<typeof advisoryRefreshBodySchema>;

export const impactExplanationSchema = z
  .object({
    action: z.string().trim().min(5).max(320),
    reason: z.string().trim().min(5).max(500),
    expectedBenefit: z.string().trim().min(5).max(450),
    impactCategory: advisoryImpactCategorySchema,
    evidence: z.string().trim().min(5).max(450),
    limitations: z.string().trim().min(5).max(450),
  })
  .strict();

export type ImpactExplanation = z.infer<typeof impactExplanationSchema>;

export const geminiBriefingPriorityItemSchema = z
  .object({
    recommendationId: z.string().trim().min(2).max(128),
    sourceModule: advisorySourceModuleSchema,
    title: z.string().trim().min(3).max(180),
    rationale: z.string().trim().min(8).max(380),
    impactCategory: advisoryImpactCategorySchema,
  })
  .strict();

export const geminiBriefingOutputSchema = z
  .object({
    headline: z.string().trim().min(5).max(180),
    summary: z.string().trim().min(12).max(650),
    outdoorInfluenceSummary: z.string().trim().min(10).max(500),
    indoorContextSummary: z.string().trim().min(10).max(500),
    priorityActions: z.array(geminiBriefingPriorityItemSchema).min(1).max(4),
    cautionsAndLimitations: z.string().trim().min(10).max(550),
    evidenceRefIds: z.array(z.string().trim().min(2).max(80)).min(1).max(8),
  })
  .strict();

export type GeminiBriefingOutput = z.infer<typeof geminiBriefingOutputSchema>;

export const geminiExplanationOutputSchema = z
  .object({
    headline: z.string().trim().min(5).max(180),
    contextualSummary: z.string().trim().min(12).max(550),
    whyThisAppliesToHousehold: z.string().trim().min(10).max(550),
    impactExplanation: impactExplanationSchema,
    alternativeOrTradeoffNote: z.string().trim().min(8).max(450),
    evidenceRefIds: z.array(z.string().trim().min(2).max(80)).min(1).max(6),
  })
  .strict();

export type GeminiExplanationOutput = z.infer<typeof geminiExplanationOutputSchema>;

export const geminiComparisonOutputSchema = z
  .object({
    headline: z.string().trim().min(5).max(180),
    summary: z.string().trim().min(12).max(550),
    currentChoiceImpact: z.string().trim().min(8).max(420),
    suggestedChoiceImpact: z.string().trim().min(8).max(420),
    impactCategory: advisoryImpactCategorySchema,
    whyPreferableForHousehold: z.string().trim().min(10).max(500),
    tradeoffsAndLimitations: z.string().trim().min(10).max(480),
    evidenceRefIds: z.array(z.string().trim().min(2).max(80)).min(1).max(6),
  })
  .strict();

export type GeminiComparisonOutput = z.infer<typeof geminiComparisonOutputSchema>;
