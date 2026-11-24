import {
  geminiBriefingOutputSchema,
  geminiComparisonOutputSchema,
  geminiExplanationOutputSchema,
  type AdvisoryRecommendationCatalogEntry,
  type GeminiBriefingOutput,
  type GeminiComparisonOutput,
  type GeminiExplanationOutput,
  type MinimizedAdvisoryContext,
} from '@uaqa/contracts';

export type GuardrailValidationResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly reason: string };

const PERCENT_CLAIM_PATTERN = /\b\d+(?:\.\d+)?\s*%/;
const CURRENCY_SAVING_PATTERN =
  /(?:[$€£]\s*\d+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*(?:PLN|USD|EUR|GBP|dollars|euros|zloty)\b)/i;
const ABSOLUTE_CLAIM_PATTERN =
  /\b(?:pollution[- ]free|zero pollution|100%\s*clean|completely safe|guarantees?\s+(?:health|safety|protection)|cures?\s+asthma|prevents?\s+(?:all\s+)?disease)\b/i;
const INVENTED_MEASURED_INDOOR_PATTERN =
  /\b(?:measured|detected|recorded)\s+(?:indoors?|inside)\b[^.]{0,60}\b\d+(?:\.\d+)?\s*(?:µg\/m³|ug\/m3|ppm|ppb)\b/i;
const POSITIVE_CYCLING_ADVICE_PATTERN =
  /\b(?:great|ideal|recommended|safe|advised)\s+(?:time|conditions?|day)?\s*(?:for|to)\s+(?:outdoor\s+)?(?:cycl(?:ing|e)|bik(?:ing|e)|jog(?:ging)?|running)\b/i;
const UNQUALIFIED_HEPA_CO_CLAIM_PATTERN =
  /\bhepa\b[^.]{0,60}\b(?:removes?|filters?|captures?|eliminates?)\b[^.]{0,40}\b(?:carbon monoxide|\bco\b|all gases)\b/i;

function extractJsonText(rawText: string): unknown {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fencedMatch?.[1] ? fencedMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function collectTextFields(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectTextFields(entry));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((entry) => collectTextFields(entry));
  }
  return [];
}

function checkUnsafeOrUnsupportedClaims(
  texts: readonly string[],
  context: MinimizedAdvisoryContext,
): string | null {
  const combined = texts.join(' ');

  if (PERCENT_CLAIM_PATTERN.test(combined)) {
    return 'Unsupported percentage claim detected in AI response.';
  }

  if (CURRENCY_SAVING_PATTERN.test(combined)) {
    return 'Unsupported financial or monetary saving claim detected in AI response.';
  }

  if (ABSOLUTE_CLAIM_PATTERN.test(combined)) {
    return 'Unsupported absolute safety or medical guarantee claim detected in AI response.';
  }

  if (INVENTED_MEASURED_INDOOR_PATTERN.test(combined)) {
    return 'Fabricated indoor sensor measurement detected in AI response.';
  }

  if (
    UNQUALIFIED_HEPA_CO_CLAIM_PATTERN.test(combined) &&
    !/\b(?:cannot|does not|do not|never)\b[^.]{0,30}\b(?:carbon monoxide|\bco\b|gases)\b/i.test(
      combined,
    )
  ) {
    return 'Inaccurate claim that HEPA filtration removes carbon monoxide or all gases.';
  }

  if (context.airQuality.isCyclingNotAdvised && POSITIVE_CYCLING_ADVICE_PATTERN.test(combined)) {
    return 'Contradictory outdoor cycling recommendation during high-pollution conditions.';
  }

  // Verify any mentioned AQI or ug/m3 numbers appear in deterministic context facts
  const allowedNumbers = new Set(context.suppliedNumericFacts);
  const numericMatches = combined.matchAll(
    /\b(?:aqi|pm2\.5|pm10|no2|o3)\s*(?:of|is|:|=)?\s*(\d+(?:\.\d+)?)\b/gi,
  );
  for (const match of numericMatches) {
    const num = match[1];
    if (num && !allowedNumbers.has(num)) {
      return `Unsupported environmental number (${num}) not supplied in deterministic inputs.`;
    }
  }

  return null;
}

function verifyEvidenceIds(
  citedIds: readonly string[],
  allowedEvidenceIds: ReadonlySet<string>,
): string | null {
  if (citedIds.length === 0) {
    return 'AI output cited zero verified evidence references.';
  }
  for (const id of citedIds) {
    if (!allowedEvidenceIds.has(id)) {
      return `AI output cited unverified evidence reference (${id}).`;
    }
  }
  return null;
}

export function validateGeminiBriefingOutput(input: {
  readonly rawText: string;
  readonly context: MinimizedAdvisoryContext;
}): GuardrailValidationResult<GeminiBriefingOutput> {
  let parsedJson: unknown;
  try {
    parsedJson = extractJsonText(input.rawText);
  } catch {
    return { ok: false, reason: 'Malformed JSON in Gemini briefing output.' };
  }

  const parsed = geminiBriefingOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, reason: 'Gemini briefing JSON failed schema validation.' };
  }

  const allowedEvidenceIds = new Set(input.context.evidenceSources.map((s) => s.id));
  const evidenceError = verifyEvidenceIds(parsed.data.evidenceRefIds, allowedEvidenceIds);
  if (evidenceError) {
    return { ok: false, reason: evidenceError };
  }

  const catalogById = new Map(
    input.context.recommendations.map((item) => [item.recommendationId, item]),
  );

  for (const action of parsed.data.priorityActions) {
    const matched = catalogById.get(action.recommendationId);
    if (!matched) {
      return {
        ok: false,
        reason: `AI briefing referenced unknown recommendation (${action.recommendationId}).`,
      };
    }
    if (
      (matched.status === 'not_advised_now' || matched.status === 'unavailable') &&
      POSITIVE_CYCLING_ADVICE_PATTERN.test(action.rationale)
    ) {
      return {
        ok: false,
        reason: `AI briefing contradicted ${matched.status} status for ${action.recommendationId}.`,
      };
    }
  }

  const claimError = checkUnsafeOrUnsupportedClaims(collectTextFields(parsed.data), input.context);
  if (claimError) {
    return { ok: false, reason: claimError };
  }

  return { ok: true, data: parsed.data };
}

export function validateGeminiExplanationOutput(input: {
  readonly rawText: string;
  readonly context: MinimizedAdvisoryContext;
  readonly recommendation: AdvisoryRecommendationCatalogEntry;
}): GuardrailValidationResult<GeminiExplanationOutput> {
  let parsedJson: unknown;
  try {
    parsedJson = extractJsonText(input.rawText);
  } catch {
    return { ok: false, reason: 'Malformed JSON in Gemini explanation output.' };
  }

  const parsed = geminiExplanationOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, reason: 'Gemini explanation JSON failed schema validation.' };
  }

  const allowedEvidenceIds = new Set(input.recommendation.evidenceIds);
  const evidenceError = verifyEvidenceIds(parsed.data.evidenceRefIds, allowedEvidenceIds);
  if (evidenceError) {
    return { ok: false, reason: evidenceError };
  }

  if (parsed.data.impactExplanation.impactCategory !== input.recommendation.impactCategory) {
    return {
      ok: false,
      reason: `AI explanation reclassified deterministic impact category (${parsed.data.impactExplanation.impactCategory} vs ${input.recommendation.impactCategory}).`,
    };
  }

  const claimError = checkUnsafeOrUnsupportedClaims(collectTextFields(parsed.data), input.context);
  if (claimError) {
    return { ok: false, reason: claimError };
  }

  return { ok: true, data: parsed.data };
}

export function validateGeminiComparisonOutput(input: {
  readonly rawText: string;
  readonly context: MinimizedAdvisoryContext;
  readonly allowedEvidenceIds: ReadonlySet<string>;
  readonly expectedImpactCategory: GeminiComparisonOutput['impactCategory'];
}): GuardrailValidationResult<GeminiComparisonOutput> {
  let parsedJson: unknown;
  try {
    parsedJson = extractJsonText(input.rawText);
  } catch {
    return { ok: false, reason: 'Malformed JSON in Gemini comparison output.' };
  }

  const parsed = geminiComparisonOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, reason: 'Gemini comparison JSON failed schema validation.' };
  }

  const evidenceError = verifyEvidenceIds(parsed.data.evidenceRefIds, input.allowedEvidenceIds);
  if (evidenceError) {
    return { ok: false, reason: evidenceError };
  }

  if (parsed.data.impactCategory !== input.expectedImpactCategory) {
    return {
      ok: false,
      reason: `AI comparison reclassified impact category (${parsed.data.impactCategory} vs ${input.expectedImpactCategory}).`,
    };
  }

  const claimError = checkUnsafeOrUnsupportedClaims(collectTextFields(parsed.data), input.context);
  if (claimError) {
    return { ok: false, reason: claimError };
  }

  return { ok: true, data: parsed.data };
}
