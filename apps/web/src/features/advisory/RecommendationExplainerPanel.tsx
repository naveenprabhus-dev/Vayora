import type {
  AdvisoryExplanationFocus,
  AdvisoryRecommendationCatalogEntry,
  AdvisorySourceModule,
  WhyRecommendationResponse,
} from '@uaqa/contracts';
import { BookOpen, Info } from 'lucide-react';
import { useId } from 'react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import {
  getAdvisoryImpactVisual,
  getGenerationModeVisual,
  getSourceModuleLabel,
} from './advisoryStyles.ts';

export interface RecommendationExplainerPanelProps {
  readonly recommendations: readonly AdvisoryRecommendationCatalogEntry[];
  readonly selectedRecommendationId: string;
  readonly selectedSourceModule: AdvisorySourceModule;
  readonly selectedFocus: AdvisoryExplanationFocus;
  readonly explanation: WhyRecommendationResponse | null;
  readonly isExplaining: boolean;
  readonly explainError: string | null;
  readonly onSelectRecommendation: (id: string, module: AdvisorySourceModule) => void;
  readonly onSelectFocus: (focus: AdvisoryExplanationFocus) => void;
  readonly onRequestExplanation: () => void;
}

const FOCUS_OPTIONS: readonly {
  readonly id: AdvisoryExplanationFocus;
  readonly label: string;
}[] = [
  { id: 'balanced', label: 'Balanced overview' },
  { id: 'exposure', label: 'Personal exposure focus' },
  { id: 'emissions', label: 'Local emissions focus' },
  { id: 'practicality', label: 'Household practicality' },
  { id: 'limitations', label: 'Limits & caveats' },
];

export function RecommendationExplainerPanel({
  recommendations,
  selectedRecommendationId,
  selectedSourceModule,
  selectedFocus,
  explanation,
  isExplaining,
  explainError,
  onSelectRecommendation,
  onSelectFocus,
  onRequestExplanation,
}: RecommendationExplainerPanelProps) {
  const selectRecId = useId();
  const modeVisual = explanation
    ? getGenerationModeVisual(explanation.generationMeta.generationMode)
    : null;
  const ModeIcon = modeVisual?.Icon;

  const impactVisual = explanation
    ? getAdvisoryImpactVisual(explanation.impactExplanation.impactCategory)
    : null;
  const ImpactIcon = impactVisual?.Icon;

  return (
    <SurfaceCard as="section" aria-labelledby="why-recommendation-heading">
      <div className="space-y-4">
        <div className="border-b border-slate-200 pb-4">
          <h3
            id="why-recommendation-heading"
            className="font-display text-xl font-bold text-slate-950"
          >
            Why This Recommendation? · 6-Part Impact Breakdown
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Understand why a specific routine, indoor precaution, or sustainable alternative applies
            to your home—and what it actually affects versus what it does not change.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0 space-y-1.5">
            <label htmlFor={selectRecId} className="block text-sm font-semibold text-slate-900">
              Select a verified recommendation
            </label>
            <select
              id={selectRecId}
              data-testid="advisory-recommendation-select"
              className="min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0F5132] focus:ring-2 focus:ring-[#0F5132] focus:outline-none"
              value={`${selectedSourceModule}:${selectedRecommendationId}`}
              onChange={(event) => {
                const [mod, ...rest] = event.target.value.split(':');
                const recId = rest.join(':');
                if (mod && recId) {
                  onSelectRecommendation(recId, mod as AdvisorySourceModule);
                }
              }}
            >
              {recommendations.map((entry) => (
                <option
                  key={`${entry.sourceModule}:${entry.recommendationId}`}
                  value={`${entry.sourceModule}:${entry.recommendationId}`}
                >
                  [{getSourceModuleLabel(entry.sourceModule)}] {entry.title}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            variant="primary"
            className="scroll-mt-20"
            disabled={isExplaining || recommendations.length === 0}
            onClick={onRequestExplanation}
          >
            {isExplaining ? 'Explaining impact...' : 'Explain impact'}
          </Button>
        </div>

        <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
          <legend className="sr-only">Explanation focus</legend>
          {FOCUS_OPTIONS.map((option) => {
            const active = selectedFocus === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectFocus(option.id)}
                className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132] ${
                  active
                    ? 'border-[#0F5132] bg-[#0F5132] text-white'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </fieldset>

        {explainError ? (
          <AlertBanner tone="error" title="Could not generate recommendation explanation">
            <p>{explainError}</p>
          </AlertBanner>
        ) : null}

        {isExplaining && !explanation ? (
          <output aria-live="polite" className="block py-4 text-sm text-slate-700">
            Preparing grounded 6-part impact explanation...
          </output>
        ) : null}

        {explanation ? (
          <div
            data-testid="why-recommendation-result"
            className="space-y-4 border-t border-slate-200 pt-4"
          >
            {modeVisual && ModeIcon ? (
              <div
                className={`flex flex-wrap items-center gap-2 text-xs font-semibold ${modeVisual.textClass}`}
              >
                <ModeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{modeVisual.label}</span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="text-slate-700">
                  {getSourceModuleLabel(explanation.recommendation.sourceModule)}
                </span>
              </div>
            ) : null}

            <div className="space-y-2">
              <h4 className="text-base font-bold text-slate-950">{explanation.headline}</h4>
              <p className="text-sm leading-relaxed text-slate-800">
                {explanation.contextualSummary}
              </p>
              <p className="text-sm leading-relaxed text-slate-700">
                <strong className="text-slate-900">Why it applies to your household: </strong>
                {explanation.whyThisAppliesToHousehold}
              </p>
            </div>

            <dl className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
              <div>
                <dt className="text-xs font-bold tracking-wide text-slate-600">1. Action</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {explanation.impactExplanation.action}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-slate-600">2. Reason</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {explanation.impactExplanation.reason}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-slate-600">
                  3. Expected Benefit
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {explanation.impactExplanation.expectedBenefit}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-slate-600">
                  4. Impact Category
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-950">
                  {impactVisual && ImpactIcon ? (
                    <span className={`inline-flex items-center gap-1.5 ${impactVisual.textClass}`}>
                      <ImpactIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{explanation.impactCategoryLabel}</span>
                    </span>
                  ) : (
                    explanation.impactCategoryLabel
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-slate-600">
                  5. Verified Evidence
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {explanation.impactExplanation.evidence}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-slate-600">6. Limitations</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {explanation.impactExplanation.limitations}
                </dd>
              </div>
            </dl>

            <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <p>
                <strong className="text-slate-900">Practical tradeoff: </strong>
                {explanation.alternativeOrTradeoffNote}
              </p>
            </div>

            {explanation.verifiedEvidence.length > 0 ? (
              <div className="border-t border-slate-200 pt-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Cited Verified Sources</span>
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-slate-700">
                  {explanation.verifiedEvidence.map((src) => (
                    <li key={src.id}>
                      <span className="font-semibold text-slate-900">{src.sourceName}</span>:{' '}
                      {src.relevantFinding}{' '}
                      <span className="text-slate-600">({src.limitations})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
