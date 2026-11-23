import type { RoutineRecommendationItem } from '@uaqa/contracts';
import {
  CATEGORY_LABELS,
  INFORMATION_BASIS_LABELS,
  getImpactTypeVisual,
  getRoutineStatusVisual,
} from './routineStyles.ts';

export interface RoutineRecommendationCardProps {
  readonly item: RoutineRecommendationItem;
}

export function RoutineRecommendationCard({ item }: RoutineRecommendationCardProps) {
  const statusVisual = getRoutineStatusVisual(item.status);
  const impactVisual = getImpactTypeVisual(item.impactType);
  const StatusIcon = statusVisual.Icon;
  const ImpactIcon = impactVisual.Icon;

  return (
    <article
      data-testid={`routine-card-${item.id}`}
      className={`rounded-xl border p-5 ${statusVisual.surfaceClass}`}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold">
        <span className={`inline-flex items-center gap-1 ${statusVisual.textClass}`}>
          <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{statusVisual.label}</span>
        </span>
        <span aria-hidden="true" className="text-slate-400">
          ·
        </span>
        <span className={`inline-flex items-center gap-1 ${impactVisual.textClass}`}>
          <ImpactIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{item.impactLabel}</span>
        </span>
        <span aria-hidden="true" className="text-slate-400">
          ·
        </span>
        <span className="text-slate-700">{CATEGORY_LABELS[item.category]}</span>
        <span aria-hidden="true" className="text-slate-400">
          ·
        </span>
        <span className="font-mono text-slate-700">{item.suggestedWindow}</span>
      </div>

      <h4 className="mt-2.5 text-lg font-bold text-slate-950">{item.title}</h4>
      <p className="mt-1 text-xs font-medium text-slate-700">
        {item.statusReason} · Basis: {INFORMATION_BASIS_LABELS[item.informationBasis]}
      </p>

      <dl className="mt-4 space-y-2.5 border-t border-slate-200/80 pt-3.5 text-sm text-slate-900">
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
            1. Recommended action
          </dt>
          <dd className="mt-0.5 leading-relaxed">{item.explanation.whatToDo}</dd>
        </div>

        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
            2. Reason for recommendation
          </dt>
          <dd className="mt-0.5 leading-relaxed">{item.explanation.whyRecommended}</dd>
        </div>

        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
            3. Influencing information &amp; air-quality context
          </dt>
          <dd className="mt-0.5 text-xs leading-relaxed text-slate-800">
            <p>{item.airQualityContext}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {item.explanation.influencingData.map((datum) => (
                <li key={datum}>{datum}</li>
              ))}
            </ul>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
            4. Expected practical benefit
          </dt>
          <dd className="mt-0.5 leading-relaxed">{item.explanation.expectedBenefit}</dd>
        </div>

        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
            5. Limitations, freshness &amp; trade-offs
          </dt>
          <dd className="mt-0.5 space-y-1 text-xs leading-relaxed text-slate-700">
            <p>{item.explanation.limitationsAndTradeoffs}</p>
            <p>{item.freshnessAndUncertainty}</p>
          </dd>
        </div>

        {item.practicalAlternative ? (
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
              Practical alternative
            </dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-slate-800">
              {item.practicalAlternative}
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
