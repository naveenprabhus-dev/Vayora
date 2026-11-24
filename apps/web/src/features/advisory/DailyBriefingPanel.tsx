import type { AdvisorySourceModule, PersonalizedBriefingResponse } from '@uaqa/contracts';
import { RefreshCw } from 'lucide-react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import {
  getAdvisoryImpactVisual,
  getGenerationModeVisual,
  getSourceModuleLabel,
} from './advisoryStyles.ts';

export interface DailyBriefingPanelProps {
  readonly briefing: PersonalizedBriefingResponse;
  readonly isRefreshing: boolean;
  readonly selectedRecommendationId: string | null;
  readonly onRefresh: () => void;
  readonly onInspectRecommendation: (
    recommendationId: string,
    sourceModule: AdvisorySourceModule,
  ) => void;
}

export function DailyBriefingPanel({
  briefing,
  isRefreshing,
  selectedRecommendationId,
  onRefresh,
  onInspectRecommendation,
}: DailyBriefingPanelProps) {
  const modeVisual = getGenerationModeVisual(briefing.generationMeta.generationMode);
  const ModeIcon = modeVisual.Icon;
  const isFallback = briefing.generationMeta.generationMode === 'deterministic_fallback';
  const isStaleOrUnavailable = briefing.generationMeta.freshnessDisclosure !== 'fresh';

  return (
    <SurfaceCard as="section" aria-labelledby="personalized-advisory-heading">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="max-w-3xl space-y-2">
          <div
            className={`flex flex-wrap items-center gap-2 text-xs font-semibold ${modeVisual.textClass}`}
          >
            <ModeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span data-testid="advisory-origin-disclosure">{modeVisual.label}</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono text-slate-700 tabular-nums">
              {briefing.generationMeta.cachedResult ? 'Cached summary' : 'Fresh synthesis'}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono text-slate-600 tabular-nums">
              {briefing.location.city}, {briefing.location.country}
            </span>
          </div>

          <h2
            id="personalized-advisory-heading"
            className="font-display text-2xl font-bold text-slate-950 text-balance"
          >
            Personalized Daily Briefing &amp; Impact Explorer
          </h2>

          <p className="text-base font-semibold text-slate-900">{briefing.headline}</p>
          <p className="text-sm leading-relaxed text-slate-700">{briefing.summary}</p>
        </div>

        <Button type="button" variant="secondary" disabled={isRefreshing} onClick={onRefresh}>
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{isRefreshing ? 'Refreshing briefing...' : 'Refresh AI briefing'}</span>
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {isFallback ? (
          <AlertBanner tone="warning" title="Deterministic fallback explanation active">
            <p>
              {briefing.generationMeta.aiDisclosure}
              {briefing.generationMeta.fallbackReason
                ? ` Reason: ${briefing.generationMeta.fallbackReason}`
                : ''}
            </p>
          </AlertBanner>
        ) : (
          <p className="text-xs leading-relaxed text-slate-600" data-testid="advisory-ai-notice">
            {briefing.generationMeta.aiDisclosure}
          </p>
        )}

        {isStaleOrUnavailable ? (
          <AlertBanner
            tone="warning"
            title={
              briefing.generationMeta.freshnessDisclosure === 'unavailable'
                ? 'Outdoor air quality data unavailable'
                : 'Stale cached outdoor air quality data active'
            }
          >
            <p>{briefing.generationMeta.freshnessMessage}</p>
          </AlertBanner>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-slate-950">Outdoor Air Quality Influence</h3>
          <p className="text-sm leading-relaxed text-slate-700">
            {briefing.outdoorInfluenceSummary}
          </p>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-slate-950">Indoor Household Context</h3>
          <p className="text-sm leading-relaxed text-slate-700">{briefing.indoorContextSummary}</p>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="text-base font-bold text-slate-950">Prioritized Household Actions Today</h3>
        <p className="mt-1 text-xs text-slate-600">
          Select any priority action to inspect its 6-part impact breakdown and verified
          public-health evidence below.
        </p>

        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {briefing.priorityActions.map((action) => {
            const impactVisual = getAdvisoryImpactVisual(action.impactCategory);
            const ImpactIcon = impactVisual.Icon;
            const isSelected = selectedRecommendationId === action.recommendationId;

            return (
              <div
                key={`${action.sourceModule}:${action.recommendationId}`}
                data-testid={`briefing-action-${action.recommendationId}`}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">
                      {getSourceModuleLabel(action.sourceModule)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${impactVisual.textClass}`}
                    >
                      <ImpactIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{impactVisual.label}</span>
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-950">{action.title}</h4>
                  <p className="text-xs leading-relaxed text-slate-700">{action.rationale}</p>
                </div>

                <div className="mt-4 pt-2">
                  <Button
                    type="button"
                    variant={isSelected ? 'primary' : 'secondary'}
                    onClick={() =>
                      onInspectRecommendation(action.recommendationId, action.sourceModule)
                    }
                  >
                    {isSelected ? 'Inspecting impact below' : 'Why this recommendation?'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-600">
        <p>{briefing.cautionsAndLimitations}</p>
      </div>
    </SurfaceCard>
  );
}
