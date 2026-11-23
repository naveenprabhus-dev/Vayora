import type { SustainableAlternativeItem } from '@uaqa/contracts';
import { Scale } from 'lucide-react';
import { Button } from '../../components/index.ts';
import { getImpactClassificationVisual, getSuitabilityVisual } from './alternativesStyles.ts';

export interface AlternativeRecommendationCardProps {
  readonly item: SustainableAlternativeItem;
  readonly isSelectedForComparison: boolean;
  readonly onCompare: (alternativeId: string) => void;
}

export function AlternativeRecommendationCard({
  item,
  isSelectedForComparison,
  onCompare,
}: AlternativeRecommendationCardProps) {
  const suitabilityVisual = getSuitabilityVisual(item.suitabilityStatus);
  const impactVisual = getImpactClassificationVisual(item.impactClassification);
  const SuitabilityIcon = suitabilityVisual.Icon;
  const ImpactIcon = impactVisual.Icon;

  return (
    <article
      data-testid={`alternative-card-${item.id}`}
      className={`flex flex-col justify-between rounded-xl border p-5 ${suitabilityVisual.surfaceClass}`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold">
          <span className={`inline-flex items-center gap-1 ${suitabilityVisual.textClass}`}>
            <SuitabilityIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{suitabilityVisual.label}</span>
          </span>
          <span aria-hidden="true" className="text-slate-400">
            ·
          </span>
          <span className={`inline-flex items-center gap-1 ${impactVisual.textClass}`}>
            <ImpactIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{impactVisual.shortLabel}</span>
          </span>
          <span aria-hidden="true" className="text-slate-400">
            ·
          </span>
          <span className="text-slate-700">{item.categoryLabel}</span>
          <span aria-hidden="true" className="text-slate-400">
            ·
          </span>
          <span className="text-slate-700">{item.affordabilityLabel}</span>
        </div>

        <h3 className="mt-2.5 text-lg font-bold text-slate-950">{item.title}</h3>
        <p className="mt-1 text-xs font-medium text-slate-700">
          {item.currentHabitMatched} · {item.relevanceLabel}
        </p>

        <dl className="mt-4 space-y-2.5 border-t border-slate-200/80 pt-3.5 text-sm text-slate-900">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
              1. Current choice vs suggested alternative
            </dt>
            <dd className="mt-0.5 space-y-1 text-xs leading-relaxed text-slate-800">
              <p>Current: {item.currentChoice}</p>
              <p className="font-semibold text-slate-950">
                Alternative: {item.suggestedAlternative}
              </p>
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
              2. Why preferable &amp; household context
            </dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-slate-800">
              <p>{item.whyPreferable}</p>
              <p className="mt-1 text-slate-600">{item.suitabilityReason}</p>
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
              3. Local air quality vs broader sustainability
            </dt>
            <dd className="mt-0.5 space-y-1 text-xs leading-relaxed text-slate-800">
              <p>{item.directAqVsBroaderNote}</p>
              <p className="text-slate-600">{item.ghgVsLocalPollutantNote}</p>
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
              4. Cost, trade-offs &amp; limitations
            </dt>
            <dd className="mt-0.5 space-y-1 text-xs leading-relaxed text-slate-700">
              <p>{item.costAndAccessibilityNote}</p>
              <p>{item.tradeoffsAndLimitations}</p>
              {item.infrastructureConditionality ? (
                <p className="font-medium text-amber-950">{item.infrastructureConditionality}</p>
              ) : null}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
              5. Evidence basis
            </dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-slate-700">
              {item.evidenceReference.sourceName} ({item.evidenceReference.versionOrDate})
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 border-t border-slate-200/80 pt-3.5">
        <Button
          type="button"
          variant={isSelectedForComparison ? 'primary' : 'secondary'}
          onClick={() => onCompare(item.id)}
        >
          <Scale className="h-4 w-4" aria-hidden="true" />
          {isSelectedForComparison ? 'Comparing side-by-side' : 'Compare side-by-side'}
        </Button>
      </div>
    </article>
  );
}
