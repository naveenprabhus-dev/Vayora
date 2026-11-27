import type { AdvisoryPriorityAction, AdvisorySourceModule } from '@uaqa/contracts';
import { ArrowRight } from 'lucide-react';
import { buildWorkspaceUrl } from '../../app/routing.ts';
import { SurfaceCard } from '../../components/index.ts';
import { getAdvisoryImpactVisual, getSourceModuleLabel } from '../advisory/advisoryStyles.ts';
import type { WorkspacePageId } from '../navigation/navConfig.ts';
import { handleWorkspaceLinkClick } from '../navigation/navigationUtils.ts';

function mapSourceModuleToPage(sourceModule: AdvisorySourceModule): WorkspacePageId {
  switch (sourceModule) {
    case 'routines':
      return 'daily-routines';
    case 'indoor':
      return 'indoor-air';
    case 'alternatives':
      return 'sustainable-alternatives';
  }
}

export interface OverviewPriorityActionsCardProps {
  readonly neighborhood: string;
  readonly city: string;
  readonly isLoading: boolean;
  readonly actions: readonly AdvisoryPriorityAction[];
  readonly onInspectAction: (recommendationId: string, sourceModule: AdvisorySourceModule) => void;
  readonly onNavigate: (pageId: WorkspacePageId) => void;
}

export function OverviewPriorityActionsCard({
  neighborhood,
  city,
  isLoading,
  actions,
  onInspectAction,
  onNavigate,
}: OverviewPriorityActionsCardProps) {
  return (
    <SurfaceCard as="section" aria-labelledby="overview-actions-heading">
      <div className="border-b border-slate-200 pb-4">
        <h2 id="overview-actions-heading" className="text-lg font-bold text-slate-950">
          Three Most Relevant Recommended Actions
        </h2>
        <p className="mt-0.5 text-xs text-slate-600">
          Highest-priority household steps for {neighborhood}, {city} based on current conditions.
        </p>
      </div>

      {isLoading ? (
        <output aria-live="polite" className="mt-4 block text-sm text-slate-700">
          Selecting top household actions...
        </output>
      ) : actions.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">No prioritized actions generated yet</p>
          <p className="mt-1 text-xs text-slate-600">
            Explore Daily Routines, Indoor Air, or Sustainable Alternatives directly for full module
            guidance.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {actions.map((action) => {
            const impactVisual = getAdvisoryImpactVisual(action.impactCategory);
            const ImpactIcon = impactVisual.Icon;
            const targetPage = mapSourceModuleToPage(action.sourceModule);

            return (
              <article
                key={`${action.sourceModule}:${action.recommendationId}`}
                data-testid={`overview-action-${action.recommendationId}`}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
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
                  <h3 className="text-sm font-bold text-slate-950">{action.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-700">{action.rationale}</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3">
                  <button
                    type="button"
                    onClick={() => onInspectAction(action.recommendationId, action.sourceModule)}
                    className="text-xs font-semibold text-[#0F5132] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
                  >
                    Why this recommendation?
                  </button>
                  <a
                    href={buildWorkspaceUrl(targetPage)}
                    onClick={(e) => handleWorkspaceLinkClick(e, targetPage, onNavigate)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 hover:text-[#0F5132] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
                  >
                    <span>Open module</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </SurfaceCard>
  );
}
