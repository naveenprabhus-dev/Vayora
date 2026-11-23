import type { IndoorActionPlanItem } from '@uaqa/contracts';
import { SurfaceCard } from '../../components/index.ts';
import { getEvidenceCategoryVisual, getIndoorActionStatusVisual } from './indoorStyles.ts';

export interface IndoorActionPlanSectionProps {
  readonly actionPlan: readonly IndoorActionPlanItem[];
}

export function IndoorActionPlanSection({ actionPlan }: IndoorActionPlanSectionProps) {
  return (
    <SurfaceCard as="section" aria-labelledby="indoor-action-plan-heading">
      <div className="space-y-1.5 border-b border-slate-200 pb-4">
        <p className="font-mono text-xs font-semibold tracking-wider text-[#0F5132] uppercase">
          Personalized Indoor Action Plan
        </p>
        <h3 id="indoor-action-plan-heading" className="text-xl font-bold text-slate-950">
          Relevant Household Actions &amp; Safety Precautions
        </h3>
        <p className="text-xs leading-relaxed text-slate-600">
          Filtered strictly to actions applicable to your saved home setup, outdoor telemetry, and
          selected activity scenario.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {actionPlan.map((item) => {
          const statusVisual = getIndoorActionStatusVisual(item.status);
          const categoryVisual = getEvidenceCategoryVisual(item.informationCategory);
          const StatusIcon = statusVisual.Icon;
          const CategoryIcon = categoryVisual.Icon;

          return (
            <article
              key={item.id}
              data-testid={`indoor-action-${item.id}`}
              className={`rounded-xl border p-5 ${statusVisual.surfaceClass}`}
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold">
                <span className={`inline-flex items-center gap-1 ${statusVisual.textClass}`}>
                  <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.statusLabel}</span>
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span className={`inline-flex items-center gap-1 ${categoryVisual.textClass}`}>
                  <CategoryIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{item.informationCategoryLabel}</span>
                </span>
                {item.highlightedByScenario ? (
                  <>
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                    <span className="font-bold text-[#0F5132]">Scenario highlight</span>
                  </>
                ) : null}
              </div>

              <h4 className="mt-2.5 text-lg font-bold text-slate-950">{item.title}</h4>

              <dl className="mt-4 space-y-2.5 border-t border-slate-200/80 pt-3.5 text-sm text-slate-900">
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                    Practical action
                  </dt>
                  <dd className="mt-0.5 leading-relaxed">{item.whatToDo}</dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                    Why recommended
                  </dt>
                  <dd className="mt-0.5 leading-relaxed">{item.whyRecommended}</dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                    Household &amp; outdoor basis
                  </dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-slate-800">
                    <ul className="list-disc space-y-0.5 pl-4">
                      {item.householdAndOutdoorContext.map((ctx) => (
                        <li key={ctx}>{ctx}</li>
                      ))}
                    </ul>
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                    Safety precaution
                  </dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-slate-800">
                    {item.precautionAndSafety}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                    Limitations
                  </dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-slate-700">
                    {item.limitations}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
