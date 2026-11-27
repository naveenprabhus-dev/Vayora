import type { DailyRoutineResponse, RoutineRecommendationItem } from '@uaqa/contracts';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { buildWorkspaceUrl } from '../../app/routing.ts';
import { AlertBanner, SurfaceCard } from '../../components/index.ts';
import type { WorkspacePageId } from '../navigation/navConfig.ts';
import { handleWorkspaceLinkClick } from '../navigation/navigationUtils.ts';
import { getRoutineStatusVisual } from '../routines/routineStyles.ts';

function selectNextUpcomingRoutine(routineData: DailyRoutineResponse | null): {
  readonly periodLabel: string;
  readonly windowHint: string;
  readonly item: RoutineRecommendationItem;
} | null {
  if (!routineData || routineData.periods.length === 0) {
    return null;
  }

  for (const group of routineData.periods) {
    const recommended = group.items.find((item) => item.status === 'recommended');
    if (recommended) {
      return {
        periodLabel: group.label,
        windowHint: group.windowHint,
        item: recommended,
      };
    }
  }

  for (const group of routineData.periods) {
    const firstItem = group.items[0];
    if (firstItem) {
      return {
        periodLabel: group.label,
        windowHint: group.windowHint,
        item: firstItem,
      };
    }
  }

  return null;
}

export interface OverviewNextRoutineCardProps {
  readonly routineData: DailyRoutineResponse | null;
  readonly routineError: string | null;
  readonly isLoadingRoutine: boolean;
  readonly onNavigate: (pageId: WorkspacePageId) => void;
}

export function OverviewNextRoutineCard({
  routineData,
  routineError,
  isLoadingRoutine,
  onNavigate,
}: OverviewNextRoutineCardProps) {
  const nextRoutine = selectNextUpcomingRoutine(routineData);
  const bestWindow = routineData?.betterTimeWindows.windows[0] ?? null;

  return (
    <SurfaceCard
      as="section"
      aria-labelledby="overview-routine-heading"
      className="flex flex-col justify-between"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-4 text-[#0F5132]">
          <CalendarClock className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 id="overview-routine-heading" className="text-lg font-bold text-slate-950">
              Next Upcoming Daily Routine
            </h2>
          </div>
        </div>

        {isLoadingRoutine && !routineData ? (
          <output aria-live="polite" className="block py-3 text-sm text-slate-700">
            Loading upcoming routine schedule...
          </output>
        ) : routineError && !routineData ? (
          <AlertBanner tone="error" title="Upcoming routine unavailable">
            <p>{routineError}</p>
          </AlertBanner>
        ) : nextRoutine ? (
          <div className="space-y-3" data-testid="overview-next-routine">
            {(() => {
              const statusVisual = getRoutineStatusVisual(nextRoutine.item.status);
              const StatusIcon = statusVisual.Icon;
              return (
                <div className={`rounded-xl border p-4 ${statusVisual.surfaceClass}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className={`inline-flex items-center gap-1 ${statusVisual.textClass}`}>
                      <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{statusVisual.label}</span>
                    </span>
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                    <span className="text-slate-800">{nextRoutine.periodLabel}</span>
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                    <span className="font-mono text-slate-700">
                      {nextRoutine.item.suggestedWindow}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-bold text-slate-950">
                    {nextRoutine.item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-800">
                    {nextRoutine.item.explanation.whatToDo}
                  </p>
                </div>
              );
            })()}

            {bestWindow ? (
              <p className="text-xs leading-relaxed text-slate-700">
                <strong className="text-slate-900">Lower-AQI forecast window: </strong>
                {bestWindow.label} ({bestWindow.rationale})
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {routineData?.overview.headline ?? 'Routine schedule summary ready'}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {routineData?.overview.summary ??
                'Open Daily Routines to inspect commute strategy and time windows.'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <a
          href={buildWorkspaceUrl('daily-routines')}
          onClick={(e) => handleWorkspaceLinkClick(e, 'daily-routines', onNavigate)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F5132] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
        >
          <span>View full Daily Routines</span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
      </div>
    </SurfaceCard>
  );
}
