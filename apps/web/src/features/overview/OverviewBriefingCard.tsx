import type { PersonalizedBriefingResponse } from '@uaqa/contracts';
import { RefreshCw, Sparkles } from 'lucide-react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import { getGenerationModeVisual } from '../advisory/advisoryStyles.ts';

export interface OverviewBriefingCardProps {
  readonly city: string;
  readonly briefing: PersonalizedBriefingResponse | null;
  readonly briefingError: string | null;
  readonly isLoadingBriefing: boolean;
  readonly isRefreshingBriefing: boolean;
  readonly isExplorerOpen: boolean;
  readonly onRefreshBriefing: () => void;
  readonly onToggleExplorer: () => void;
}

export function OverviewBriefingCard({
  city,
  briefing,
  briefingError,
  isLoadingBriefing,
  isRefreshingBriefing,
  isExplorerOpen,
  onRefreshBriefing,
  onToggleExplorer,
}: OverviewBriefingCardProps) {
  const modeVisual = briefing
    ? getGenerationModeVisual(briefing.generationMeta.generationMode)
    : null;
  const ModeIcon = modeVisual?.Icon;

  return (
    <SurfaceCard
      as="section"
      aria-labelledby="overview-briefing-heading"
      className="flex flex-col justify-between lg:col-span-7"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 id="overview-briefing-heading" className="text-lg font-bold text-slate-950">
              Short Air-Quality Briefing
            </h2>
            {modeVisual && ModeIcon && briefing ? (
              <p
                className={`mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold ${modeVisual.textClass}`}
              >
                <ModeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span data-testid="advisory-origin-disclosure">{modeVisual.label}</span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-mono text-slate-600">
                  {briefing.generationMeta.cachedResult ? 'Cached summary' : 'Fresh synthesis'}
                </span>
              </p>
            ) : null}
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={isRefreshingBriefing || isLoadingBriefing}
            onClick={onRefreshBriefing}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshingBriefing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isRefreshingBriefing ? 'Refreshing...' : 'Refresh briefing'}</span>
          </Button>
        </div>

        {isLoadingBriefing && !briefing ? (
          <output aria-live="polite" className="block py-4 text-sm text-slate-700">
            Preparing concise daily briefing for {city}...
          </output>
        ) : briefingError && !briefing ? (
          <AlertBanner tone="error" title="Air-quality briefing unavailable">
            <p>{briefingError}</p>
            <div className="mt-3">
              <Button type="button" variant="secondary" onClick={onRefreshBriefing}>
                Retry briefing
              </Button>
            </div>
          </AlertBanner>
        ) : briefing ? (
          <div className="space-y-3">
            {briefing.generationMeta.generationMode === 'deterministic_fallback' ? (
              <AlertBanner tone="warning" title="Deterministic fallback explanation active">
                <p>
                  {briefing.generationMeta.aiDisclosure}
                  {briefing.generationMeta.fallbackReason
                    ? ` Reason: ${briefing.generationMeta.fallbackReason}`
                    : ''}
                </p>
              </AlertBanner>
            ) : null}

            {briefing.generationMeta.freshnessDisclosure !== 'fresh' ? (
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

            <h3 className="text-base font-bold text-slate-950">{briefing.headline}</h3>
            <p className="text-sm leading-relaxed text-slate-700">{briefing.summary}</p>
            <p className="text-xs leading-relaxed text-slate-600">
              <strong className="text-slate-800">Outdoor influence: </strong>
              {briefing.outdoorInfluenceSummary}
            </p>
            <p className="text-xs leading-relaxed text-slate-600">
              {briefing.cautionsAndLimitations}
            </p>
          </div>
        ) : null}
      </div>

      {briefing ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <Button
            type="button"
            variant="secondary"
            aria-expanded={isExplorerOpen}
            onClick={onToggleExplorer}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {isExplorerOpen ? 'Hide impact & choice explorer' : 'Open impact & choice explorer'}
          </Button>
          <span className="text-xs text-slate-600">{briefing.generationMeta.nonMedicalNotice}</span>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
