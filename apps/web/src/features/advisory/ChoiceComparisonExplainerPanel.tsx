import type {
  AdvisoryRecommendationCatalogEntry,
  ChoiceComparisonExplanationResponse,
} from '@uaqa/contracts';
import { Scale } from 'lucide-react';
import { useId } from 'react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import { getAdvisoryImpactVisual, getGenerationModeVisual } from './advisoryStyles.ts';

export interface ChoiceComparisonExplainerPanelProps {
  readonly alternativeOptions: readonly AdvisoryRecommendationCatalogEntry[];
  readonly selectedAlternativeId: string;
  readonly comparisonExplanation: ChoiceComparisonExplanationResponse | null;
  readonly isComparing: boolean;
  readonly compareError: string | null;
  readonly onSelectAlternativeId: (alternativeId: string) => void;
  readonly onRequestComparison: () => void;
}

export function ChoiceComparisonExplainerPanel({
  alternativeOptions,
  selectedAlternativeId,
  comparisonExplanation,
  isComparing,
  compareError,
  onSelectAlternativeId,
  onRequestComparison,
}: ChoiceComparisonExplainerPanelProps) {
  const selectAltId = useId();
  const modeVisual = comparisonExplanation
    ? getGenerationModeVisual(comparisonExplanation.generationMeta.generationMode)
    : null;
  const ModeIcon = modeVisual?.Icon;

  const impactVisual = comparisonExplanation
    ? getAdvisoryImpactVisual(comparisonExplanation.impactCategory)
    : null;
  const ImpactIcon = impactVisual?.Icon;

  return (
    <SurfaceCard as="section" aria-labelledby="compare-choices-heading">
      <div className="space-y-4">
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Scale className="h-4 w-4 shrink-0 text-[#0F5132]" aria-hidden="true" />
            <span>Compare My Choices</span>
          </div>
          <h3
            id="compare-choices-heading"
            className="mt-1 font-display text-xl font-bold text-slate-950"
          >
            Contextualize Tradeoffs Across Everyday Choices
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Inspect how switching from your current habit changes local emissions, personal
            exposure, or broader sustainability without invented percentage claims.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <label htmlFor={selectAltId} className="block text-sm font-semibold text-slate-900">
              Select a sustainable alternative to explain
            </label>
            <select
              id={selectAltId}
              data-testid="advisory-compare-select"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0F5132] focus:ring-2 focus:ring-[#0F5132] focus:outline-none"
              value={selectedAlternativeId}
              onChange={(event) => onSelectAlternativeId(event.target.value)}
            >
              {alternativeOptions.map((alt) => (
                <option key={alt.recommendationId} value={alt.recommendationId}>
                  {alt.title}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            variant="primary"
            disabled={isComparing || alternativeOptions.length === 0}
            onClick={onRequestComparison}
          >
            {isComparing ? 'Comparing choices...' : 'Compare my choices'}
          </Button>
        </div>

        {compareError ? (
          <AlertBanner tone="error" title="Choice comparison unavailable">
            <p>{compareError}</p>
          </AlertBanner>
        ) : null}

        {comparisonExplanation ? (
          <div
            data-testid="compare-choices-result"
            className="space-y-4 border-t border-slate-200 pt-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {modeVisual && ModeIcon ? (
                <span className={`inline-flex items-center gap-1.5 ${modeVisual.textClass}`}>
                  <ModeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{modeVisual.label}</span>
                </span>
              ) : null}
              {impactVisual && ImpactIcon ? (
                <>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className={`inline-flex items-center gap-1.5 ${impactVisual.textClass}`}>
                    <ImpactIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{comparisonExplanation.impactCategoryLabel}</span>
                  </span>
                </>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-slate-950">
                {comparisonExplanation.headline}
              </h4>
              <p className="text-sm leading-relaxed text-slate-800">
                {comparisonExplanation.summary}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-bold tracking-wide text-slate-600">
                  Current Habit Impact (
                  {comparisonExplanation.deterministicComparison.selectedBaselineLabel})
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800">
                  {comparisonExplanation.currentChoiceImpact}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <p className="text-xs font-bold tracking-wide text-[#0F5132]">
                  Suggested Alternative Impact
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-900">
                  {comparisonExplanation.suggestedChoiceImpact}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm leading-relaxed text-slate-700">
              <p>
                <strong className="text-slate-900">Why this fits your household: </strong>
                {comparisonExplanation.whyPreferableForHousehold}
              </p>
              <p className="text-xs text-slate-600">
                <strong className="text-slate-800">Limitations &amp; context: </strong>
                {comparisonExplanation.tradeoffsAndLimitations}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
