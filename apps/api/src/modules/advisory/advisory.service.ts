import type {
  AdvisoryBriefingQueryInput,
  AdvisoryCompareBodyInput,
  AdvisoryExplainBodyInput,
  AdvisoryExplanationFocus,
  AdvisoryOperationalMetrics,
  AdvisoryRecommendationCatalogEntry,
  AdvisoryRefreshBodyInput,
  ChoiceComparisonExplanationResponse,
  MinimizedAdvisoryContext,
  PersonalizedBriefingResponse,
  WhyRecommendationResponse,
} from '@uaqa/contracts';
import type { HouseholdRepository } from '../../repositories/household.repository.ts';
import {
  GeminiNotConfiguredError,
  GeminiTimeoutError,
  type GeminiAdvisoryClient,
} from '../../services/ai/geminiClient.ts';
import { NotFoundError } from '../../utils/errors.ts';
import type { SustainableAlternativesService } from '../alternatives/alternatives.service.ts';
import type { IndoorAirService } from '../indoor/indoor.service.ts';
import type { RoutinesService } from '../routines/routines.service.ts';
import { AdvisoryCacheRepository } from './advisory.cache.ts';
import {
  ADVISORY_IMPACT_LABELS,
  ADVISORY_SYSTEM_INSTRUCTION,
  ADVISORY_TIMEOUT_MS,
} from './advisory.constants.ts';
import { AdvisoryMetricsTracker } from './advisory.metrics.ts';
import {
  buildAdvisoryFingerprint,
  buildMinimizedAdvisoryContext,
} from './utils/context-minimizer.ts';
import {
  buildDeterministicBriefingFallback,
  buildDeterministicComparisonFallback,
  buildDeterministicWhyFallback,
  buildGenerationMeta,
  mapComparisonImpactCategory,
} from './utils/deterministic-fallback.ts';
import {
  validateGeminiBriefingOutput,
  validateGeminiComparisonOutput,
  validateGeminiExplanationOutput,
} from './utils/output-validator.ts';
import {
  buildBriefingPrompt,
  buildCompareChoicesPrompt,
  buildExplainRecommendationPrompt,
  GEMINI_BRIEFING_RESPONSE_SCHEMA,
  GEMINI_COMPARISON_RESPONSE_SCHEMA,
  GEMINI_EXPLANATION_RESPONSE_SCHEMA,
} from './utils/prompt-builder.ts';

export interface AdvisoryServiceDependencies {
  readonly householdRepository: HouseholdRepository;
  readonly routinesService: RoutinesService;
  readonly indoorAirService: IndoorAirService;
  readonly alternativesService: SustainableAlternativesService;
  readonly geminiClient: GeminiAdvisoryClient;
  readonly cacheRepository?: AdvisoryCacheRepository;
  readonly metricsTracker?: AdvisoryMetricsTracker;
  readonly timeoutMs?: number;
}

function sanitizeSafeReason(error: unknown): string {
  if (error instanceof GeminiNotConfiguredError) {
    return 'Gemini API key is not configured on the server.';
  }
  if (error instanceof GeminiTimeoutError) {
    return error.message;
  }
  return 'Gemini generation failed or returned an unverified response; deterministic fallback activated.';
}

export class AdvisoryService {
  private readonly householdRepository: HouseholdRepository;
  private readonly routinesService: RoutinesService;
  private readonly indoorAirService: IndoorAirService;
  private readonly alternativesService: SustainableAlternativesService;
  private readonly geminiClient: GeminiAdvisoryClient;
  private readonly cacheRepository: AdvisoryCacheRepository;
  private readonly metricsTracker: AdvisoryMetricsTracker;
  private readonly timeoutMs: number;

  public constructor(deps: AdvisoryServiceDependencies) {
    this.householdRepository = deps.householdRepository;
    this.routinesService = deps.routinesService;
    this.indoorAirService = deps.indoorAirService;
    this.alternativesService = deps.alternativesService;
    this.geminiClient = deps.geminiClient;
    this.cacheRepository = deps.cacheRepository ?? new AdvisoryCacheRepository();
    this.metricsTracker = deps.metricsTracker ?? new AdvisoryMetricsTracker();
    this.timeoutMs = deps.timeoutMs ?? ADVISORY_TIMEOUT_MS;
  }

  public getMetricsSnapshot(): AdvisoryOperationalMetrics {
    return this.metricsTracker.snapshot();
  }

  private async loadVerifiedHouseholdContext(ownerUid: string): Promise<{
    readonly routines: Awaited<ReturnType<RoutinesService['getDailyRoutines']>>;
    readonly indoor: Awaited<ReturnType<IndoorAirService['getIndoorAirGuidance']>>;
    readonly alternatives: Awaited<
      ReturnType<SustainableAlternativesService['getRecommendations']>
    >;
    readonly context: MinimizedAdvisoryContext;
  }> {
    const profile = await this.householdRepository.findByOwnerUid(ownerUid);
    if (!profile) {
      throw new NotFoundError(
        'Complete household onboarding before generating personalized AI advisory explanations.',
      );
    }

    const [routines, indoor, alternatives] = await Promise.all([
      this.routinesService.getDailyRoutines(ownerUid),
      this.indoorAirService.getIndoorAirGuidance(ownerUid),
      this.alternativesService.getRecommendations(ownerUid),
    ]);

    const context = buildMinimizedAdvisoryContext({
      profile,
      routines,
      indoor,
      alternatives,
    });

    return { routines, indoor, alternatives, context };
  }

  public async getDailyBriefing(
    ownerUid: string,
    query: AdvisoryBriefingQueryInput = {},
  ): Promise<PersonalizedBriefingResponse> {
    const focus: AdvisoryExplanationFocus = query.focus ?? 'balanced';
    const { routines, indoor, alternatives, context } =
      await this.loadVerifiedHouseholdContext(ownerUid);

    const cacheKey = buildAdvisoryFingerprint({
      ownerUid,
      operation: 'briefing',
      minimizedContext: context,
      extra: focus,
    });

    if (!query.forceRefresh) {
      const cached = this.cacheRepository.getFresh<PersonalizedBriefingResponse>(cacheKey);
      if (cached) {
        this.metricsTracker.recordCacheHit();
        return {
          ...cached,
          generationMeta: {
            ...cached.generationMeta,
            cachedResult: true,
          },
        };
      }
    }

    this.metricsTracker.recordCacheMiss();
    if (this.cacheRepository.hasInFlight(cacheKey)) {
      this.metricsTracker.recordCoalescedRequest();
    }

    return this.cacheRepository.runCoalesced(cacheKey, async () => {
      const startMs = Date.now();
      const catalogById = new Map(
        context.recommendations.map((item) => [item.recommendationId, item]),
      );

      if (!this.geminiClient.isConfigured()) {
        const latencyMs = Date.now() - startMs;
        const reason = 'Gemini API key is not configured on the server.';
        this.metricsTracker.recordFallback(latencyMs, reason);
        const fallback = buildDeterministicBriefingFallback({
          briefingId: cacheKey,
          context,
          routines,
          indoor,
          alternatives,
          model: this.geminiClient.model,
          fallbackReason: reason,
          latencyMs,
          focus,
        });
        this.cacheRepository.set(cacheKey, fallback);
        return fallback;
      }

      this.metricsTracker.recordGeminiAttempt();
      try {
        const aiRes = await this.geminiClient.generateStructuredJson({
          systemInstruction: ADVISORY_SYSTEM_INSTRUCTION,
          prompt: buildBriefingPrompt(context, focus),
          responseSchema: GEMINI_BRIEFING_RESPONSE_SCHEMA,
          timeoutMs: this.timeoutMs,
        });

        const latencyMs = Date.now() - startMs;
        const validated = validateGeminiBriefingOutput({
          rawText: aiRes.rawText,
          context,
        });

        if (!validated.ok) {
          this.metricsTracker.recordValidationFailure(latencyMs, validated.reason);
          return buildDeterministicBriefingFallback({
            briefingId: cacheKey,
            context,
            routines,
            indoor,
            alternatives,
            model: aiRes.model,
            fallbackReason: validated.reason,
            latencyMs,
            focus,
          });
        }

        this.metricsTracker.recordGeminiSuccess(latencyMs, aiRes.totalTokens);

        const priorityActions = validated.data.priorityActions.map((item) => {
          const matched = catalogById.get(item.recommendationId);
          const resolvedCategory = matched?.impactCategory ?? item.impactCategory;
          return {
            recommendationId: item.recommendationId,
            sourceModule: matched?.sourceModule ?? item.sourceModule,
            title: item.title,
            rationale: item.rationale,
            impactCategory: resolvedCategory,
            impactCategoryLabel: ADVISORY_IMPACT_LABELS[resolvedCategory],
            deterministicStatus: matched?.status ?? 'recommended',
          };
        });

        const citedSet = new Set(validated.data.evidenceRefIds);
        const verifiedEvidence = context.evidenceSources.filter((src) => citedSet.has(src.id));

        const response: PersonalizedBriefingResponse = {
          briefingId: cacheKey,
          location: routines.location,
          householdSummary: context.household,
          airQualitySnapshot: context.airQuality,
          headline: validated.data.headline,
          summary: validated.data.summary,
          outdoorInfluenceSummary: validated.data.outdoorInfluenceSummary,
          indoorContextSummary: validated.data.indoorContextSummary,
          priorityActions,
          cautionsAndLimitations: validated.data.cautionsAndLimitations,
          verifiedEvidence,
          availableRecommendations: context.recommendations,
          generationMeta: buildGenerationMeta({
            mode: 'gemini',
            model: aiRes.model,
            fallbackReason: null,
            context,
            contextFingerprint: cacheKey,
            cachedResult: false,
            latencyMs,
            focus,
          }),
        };

        this.cacheRepository.set(cacheKey, response);
        return response;
      } catch (error) {
        const latencyMs = Date.now() - startMs;
        const reason = sanitizeSafeReason(error);
        if (error instanceof GeminiTimeoutError) {
          this.metricsTracker.recordTimeout(latencyMs, reason);
        } else {
          this.metricsTracker.recordFallback(latencyMs, reason);
        }
        return buildDeterministicBriefingFallback({
          briefingId: cacheKey,
          context,
          routines,
          indoor,
          alternatives,
          model: this.geminiClient.model,
          fallbackReason: reason,
          latencyMs,
          focus,
        });
      }
    });
  }

  public async explainRecommendation(
    ownerUid: string,
    body: AdvisoryExplainBodyInput,
  ): Promise<WhyRecommendationResponse> {
    const focus: AdvisoryExplanationFocus = body.focus ?? 'balanced';
    const { context } = await this.loadVerifiedHouseholdContext(ownerUid);

    const recommendation = context.recommendations.find(
      (item) =>
        item.recommendationId === body.recommendationId && item.sourceModule === body.sourceModule,
    );

    if (!recommendation) {
      throw new NotFoundError(
        `No recommendation found matching "${body.recommendationId}" in module "${body.sourceModule}".`,
      );
    }

    const cacheKey = buildAdvisoryFingerprint({
      ownerUid,
      operation: 'explain',
      minimizedContext: context,
      targetId: `${body.sourceModule}:${body.recommendationId}`,
      extra: focus,
    });

    const cached = this.cacheRepository.getFresh<WhyRecommendationResponse>(cacheKey);
    if (cached) {
      this.metricsTracker.recordCacheHit();
      return {
        ...cached,
        generationMeta: {
          ...cached.generationMeta,
          cachedResult: true,
        },
      };
    }

    this.metricsTracker.recordCacheMiss();
    if (this.cacheRepository.hasInFlight(cacheKey)) {
      this.metricsTracker.recordCoalescedRequest();
    }

    return this.cacheRepository.runCoalesced(cacheKey, async () => {
      const startMs = Date.now();
      if (!this.geminiClient.isConfigured()) {
        const latencyMs = Date.now() - startMs;
        const reason = 'Gemini API key is not configured on the server.';
        this.metricsTracker.recordFallback(latencyMs, reason);
        const fallback = buildDeterministicWhyFallback({
          explanationId: cacheKey,
          context,
          recommendation,
          model: this.geminiClient.model,
          fallbackReason: reason,
          latencyMs,
          focus,
        });
        this.cacheRepository.set(cacheKey, fallback);
        return fallback;
      }

      this.metricsTracker.recordGeminiAttempt();
      try {
        const aiRes = await this.geminiClient.generateStructuredJson({
          systemInstruction: ADVISORY_SYSTEM_INSTRUCTION,
          prompt: buildExplainRecommendationPrompt({ context, recommendation, focus }),
          responseSchema: GEMINI_EXPLANATION_RESPONSE_SCHEMA,
          timeoutMs: this.timeoutMs,
        });

        const latencyMs = Date.now() - startMs;
        const validated = validateGeminiExplanationOutput({
          rawText: aiRes.rawText,
          context,
          recommendation,
        });

        if (!validated.ok) {
          this.metricsTracker.recordValidationFailure(latencyMs, validated.reason);
          return buildDeterministicWhyFallback({
            explanationId: cacheKey,
            context,
            recommendation,
            model: aiRes.model,
            fallbackReason: validated.reason,
            latencyMs,
            focus,
          });
        }

        this.metricsTracker.recordGeminiSuccess(latencyMs, aiRes.totalTokens);

        const citedSet = new Set(validated.data.evidenceRefIds);
        const verifiedEvidence = context.evidenceSources.filter((src) => citedSet.has(src.id));

        const response: WhyRecommendationResponse = {
          explanationId: cacheKey,
          recommendation,
          headline: validated.data.headline,
          contextualSummary: validated.data.contextualSummary,
          whyThisAppliesToHousehold: validated.data.whyThisAppliesToHousehold,
          impactExplanation: validated.data.impactExplanation,
          impactCategoryLabel:
            ADVISORY_IMPACT_LABELS[validated.data.impactExplanation.impactCategory],
          alternativeOrTradeoffNote: validated.data.alternativeOrTradeoffNote,
          verifiedEvidence,
          generationMeta: buildGenerationMeta({
            mode: 'gemini',
            model: aiRes.model,
            fallbackReason: null,
            context,
            contextFingerprint: cacheKey,
            cachedResult: false,
            latencyMs,
            focus,
          }),
        };

        this.cacheRepository.set(cacheKey, response);
        return response;
      } catch (error) {
        const latencyMs = Date.now() - startMs;
        const reason = sanitizeSafeReason(error);
        if (error instanceof GeminiTimeoutError) {
          this.metricsTracker.recordTimeout(latencyMs, reason);
        } else {
          this.metricsTracker.recordFallback(latencyMs, reason);
        }
        return buildDeterministicWhyFallback({
          explanationId: cacheKey,
          context,
          recommendation,
          model: this.geminiClient.model,
          fallbackReason: reason,
          latencyMs,
          focus,
        });
      }
    });
  }

  public async compareChoicesExplanation(
    ownerUid: string,
    body: AdvisoryCompareBodyInput,
  ): Promise<ChoiceComparisonExplanationResponse> {
    const focus: AdvisoryExplanationFocus = body.focus ?? 'balanced';
    const [{ context }, comparison] = await Promise.all([
      this.loadVerifiedHouseholdContext(ownerUid),
      this.alternativesService.compareAlternative(ownerUid, {
        alternativeId: body.alternativeId,
        ...(body.currentOption !== undefined ? { currentOption: body.currentOption } : {}),
      }),
    ]);

    const recommendation: AdvisoryRecommendationCatalogEntry | undefined =
      context.recommendations.find(
        (item) =>
          item.sourceModule === 'alternatives' && item.recommendationId === body.alternativeId,
      );

    const cacheKey = buildAdvisoryFingerprint({
      ownerUid,
      operation: 'compare',
      minimizedContext: context,
      targetId: `${body.alternativeId}:${comparison.selectedBaselineId}`,
      extra: focus,
    });

    const cached = this.cacheRepository.getFresh<ChoiceComparisonExplanationResponse>(cacheKey);
    if (cached) {
      this.metricsTracker.recordCacheHit();
      return {
        ...cached,
        generationMeta: {
          ...cached.generationMeta,
          cachedResult: true,
        },
      };
    }

    this.metricsTracker.recordCacheMiss();
    if (this.cacheRepository.hasInFlight(cacheKey)) {
      this.metricsTracker.recordCoalescedRequest();
    }

    return this.cacheRepository.runCoalesced(cacheKey, async () => {
      const startMs = Date.now();
      const expectedImpactCategory = mapComparisonImpactCategory(comparison);
      const allowedEvidenceIds = new Set(recommendation?.evidenceIds ?? ['EV-OPEN-METEO']);

      if (!this.geminiClient.isConfigured()) {
        const latencyMs = Date.now() - startMs;
        const reason = 'Gemini API key is not configured on the server.';
        this.metricsTracker.recordFallback(latencyMs, reason);
        const fallback = buildDeterministicComparisonFallback({
          comparisonExplanationId: cacheKey,
          context,
          comparison,
          recommendation,
          model: this.geminiClient.model,
          fallbackReason: reason,
          latencyMs,
          focus,
        });
        this.cacheRepository.set(cacheKey, fallback);
        return fallback;
      }

      this.metricsTracker.recordGeminiAttempt();
      try {
        const aiRes = await this.geminiClient.generateStructuredJson({
          systemInstruction: ADVISORY_SYSTEM_INSTRUCTION,
          prompt: buildCompareChoicesPrompt({ context, comparison, recommendation, focus }),
          responseSchema: GEMINI_COMPARISON_RESPONSE_SCHEMA,
          timeoutMs: this.timeoutMs,
        });

        const latencyMs = Date.now() - startMs;
        const validated = validateGeminiComparisonOutput({
          rawText: aiRes.rawText,
          context,
          allowedEvidenceIds,
          expectedImpactCategory,
        });

        if (!validated.ok) {
          this.metricsTracker.recordValidationFailure(latencyMs, validated.reason);
          return buildDeterministicComparisonFallback({
            comparisonExplanationId: cacheKey,
            context,
            comparison,
            recommendation,
            model: aiRes.model,
            fallbackReason: validated.reason,
            latencyMs,
            focus,
          });
        }

        this.metricsTracker.recordGeminiSuccess(latencyMs, aiRes.totalTokens);

        const citedSet = new Set(validated.data.evidenceRefIds);
        const verifiedEvidence = context.evidenceSources.filter((src) => citedSet.has(src.id));

        const response: ChoiceComparisonExplanationResponse = {
          comparisonExplanationId: cacheKey,
          deterministicComparison: comparison,
          headline: validated.data.headline,
          summary: validated.data.summary,
          currentChoiceImpact: validated.data.currentChoiceImpact,
          suggestedChoiceImpact: validated.data.suggestedChoiceImpact,
          impactCategory: validated.data.impactCategory,
          impactCategoryLabel: ADVISORY_IMPACT_LABELS[validated.data.impactCategory],
          whyPreferableForHousehold: validated.data.whyPreferableForHousehold,
          tradeoffsAndLimitations: validated.data.tradeoffsAndLimitations,
          verifiedEvidence,
          generationMeta: buildGenerationMeta({
            mode: 'gemini',
            model: aiRes.model,
            fallbackReason: null,
            context,
            contextFingerprint: cacheKey,
            cachedResult: false,
            latencyMs,
            focus,
          }),
        };

        this.cacheRepository.set(cacheKey, response);
        return response;
      } catch (error) {
        const latencyMs = Date.now() - startMs;
        const reason = sanitizeSafeReason(error);
        if (error instanceof GeminiTimeoutError) {
          this.metricsTracker.recordTimeout(latencyMs, reason);
        } else {
          this.metricsTracker.recordFallback(latencyMs, reason);
        }
        return buildDeterministicComparisonFallback({
          comparisonExplanationId: cacheKey,
          context,
          comparison,
          recommendation,
          model: this.geminiClient.model,
          fallbackReason: reason,
          latencyMs,
          focus,
        });
      }
    });
  }

  public async refreshAdvisory(
    ownerUid: string,
    body: AdvisoryRefreshBodyInput = { forceRefresh: true },
  ): Promise<PersonalizedBriefingResponse> {
    if (body.forceRefresh) {
      this.cacheRepository.invalidateOwner(ownerUid);
    }

    return this.getDailyBriefing(ownerUid, {
      ...(body.focus !== undefined ? { focus: body.focus } : {}),
      forceRefresh: body.forceRefresh,
    });
  }
}
