import type { AlternativeComparisonView } from '@uaqa/contracts';
import { ExternalLink, Scale } from 'lucide-react';
import { AlertBanner, SurfaceCard } from '../../components/index.ts';
import { getImpactClassificationVisual, getSuitabilityVisual } from './alternativesStyles.ts';

export interface AlternativeComparisonPanelProps {
  readonly comparison: AlternativeComparisonView;
  readonly isComparing: boolean;
  readonly onSelectBaseline: (alternativeId: string, baselineId: string) => void;
}

export function AlternativeComparisonPanel({
  comparison,
  isComparing,
  onSelectBaseline,
}: AlternativeComparisonPanelProps) {
  const suitabilityVisual = getSuitabilityVisual(comparison.suitabilityStatus);
  const impactVisual = getImpactClassificationVisual(comparison.impactClassification);
  const SuitabilityIcon = suitabilityVisual.Icon;
  const ImpactIcon = impactVisual.Icon;
  const safeSourceUrl = (() => {
    try {
      const parsed = new URL(comparison.evidenceReference.sourceUrl);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
    } catch {
      return null;
    }
  })();

  return (
    <SurfaceCard
      as="section"
      aria-labelledby="alternative-comparison-heading"
      data-testid="alternative-comparison-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1.5">
          <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider text-[#0F5132] uppercase">
            <Scale className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Side-by-side comparison</span>
          </p>
          <h3 id="alternative-comparison-heading" className="text-xl font-bold text-slate-950">
            {comparison.alternativeTitle}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold">
            <span className={`inline-flex items-center gap-1 ${suitabilityVisual.textClass}`}>
              <SuitabilityIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{suitabilityVisual.label}</span>
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className={`inline-flex items-center gap-1 ${impactVisual.textClass}`}>
              <ImpactIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{comparison.impactClassificationLabel}</span>
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="text-slate-700">{comparison.affordabilityLabel}</span>
          </div>
        </div>

        {isComparing ? (
          <output aria-live="polite" className="font-mono text-xs font-medium text-slate-600">
            Updating comparison...
          </output>
        ) : null}
      </div>

      {comparison.availableBaselines.length > 1 ? (
        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-semibold text-slate-700">
            Compare against current option:
          </legend>
          <div className="flex flex-wrap gap-2">
            {comparison.availableBaselines.map((baseline) => {
              const selected = baseline.id === comparison.selectedBaselineId;
              return (
                <button
                  key={baseline.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={isComparing}
                  onClick={() => onSelectBaseline(comparison.alternativeId, baseline.id)}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                    selected
                      ? 'border-[#0F5132] bg-[#0F5132] text-white'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {baseline.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
            Current choice: {comparison.selectedBaselineLabel}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-900">
            {comparison.currentChoiceSummary}
          </p>
        </div>

        <div className={`rounded-xl border p-4 ${suitabilityVisual.surfaceClass}`}>
          <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
            Suggested alternative
          </p>
          <p className="mt-1.5 text-sm leading-relaxed font-medium text-slate-950">
            {comparison.suggestedAlternativeSummary}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-slate-200 pt-4 text-sm text-slate-900 md:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
            Why it is preferable
          </dt>
          <dd className="mt-1 leading-relaxed">{comparison.whyPreferable}</dd>
        </div>

        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
            Direct air quality &amp; emissions impact
          </dt>
          <dd className="mt-1 leading-relaxed">{comparison.directAirQualityAndEmissionsEffect}</dd>
        </div>

        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
            Personal exposure vs broader sustainability
          </dt>
          <dd className="mt-1 space-y-1.5 text-xs leading-relaxed text-slate-800">
            <p>{comparison.personalExposureEffect}</p>
            <p>{comparison.broaderSustainabilityEffect}</p>
            <p className="font-medium text-slate-900">
              {comparison.ghgVsLocalPollutantDistinction}
            </p>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
            Cost, accessibility &amp; trade-offs
          </dt>
          <dd className="mt-1 space-y-1.5 text-xs leading-relaxed text-slate-800">
            <p>{comparison.costAndAccessibility}</p>
            <p>{comparison.tradeoffsAndLimitations}</p>
          </dd>
        </div>
      </dl>

      {comparison.infrastructureConditionality ? (
        <div className="mt-4">
          <AlertBanner tone="warning" title="Local infrastructure feasibility condition">
            <p>{comparison.infrastructureConditionality}</p>
          </AlertBanner>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">
          Evidence reference: {comparison.evidenceReference.sourceName} (
          {comparison.evidenceReference.versionOrDate})
        </p>
        <p className="mt-1 leading-relaxed">{comparison.evidenceReference.relevantFinding}</p>
        <p className="mt-1 leading-relaxed text-slate-600">
          Limitations: {comparison.evidenceReference.limitations}
        </p>
        {safeSourceUrl ? (
          <p className="mt-2">
            <a
              href={safeSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#0F5132] underline underline-offset-4 hover:text-emerald-900"
            >
              <span>Inspect external reference</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
          </p>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
