import type { AqiReadingSummary, AqiScaleId, DominantPollutantSummary } from '@uaqa/contracts';
import { SurfaceCard } from '../../components/index.ts';
import { getAqiSeverityVisual } from './severityStyles.ts';

export interface AqiSummaryCardProps {
  readonly usAqi: AqiReadingSummary;
  readonly europeanAqi: AqiReadingSummary;
  readonly dominantPollutant: DominantPollutantSummary;
  readonly selectedScale: AqiScaleId;
  readonly onSelectScale: (scale: AqiScaleId) => void;
}

export function AqiSummaryCard({
  usAqi,
  europeanAqi,
  dominantPollutant,
  selectedScale,
  onSelectScale,
}: AqiSummaryCardProps) {
  const activeReading = selectedScale === 'us_aqi' ? usAqi : europeanAqi;
  const companionReading = selectedScale === 'us_aqi' ? europeanAqi : usAqi;
  const visual = getAqiSeverityVisual(activeReading.severityToken);
  const ActiveIcon = visual.Icon;

  const companionVisual = getAqiSeverityVisual(companionReading.severityToken);
  const CompanionIcon = companionVisual.Icon;

  return (
    <SurfaceCard as="section" aria-labelledby="aqi-summary-heading">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="aqi-summary-heading" className="text-xl font-bold text-slate-950">
            Air Quality Index Summary
          </h2>
          <p className="text-sm text-slate-600">
            US AQI (EPA 0–500) and European AQI (EEA 0–100+) are reported on their own distinct
            scales and never blended.
          </p>
        </div>

        <fieldset className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
          <legend className="sr-only">Select primary AQI scale</legend>
          <button
            type="button"
            aria-pressed={selectedScale === 'us_aqi'}
            onClick={() => onSelectScale('us_aqi')}
            className={`min-h-11 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${
              selectedScale === 'us_aqi'
                ? 'bg-[#0F5132] text-white'
                : 'text-slate-800 hover:bg-white'
            }`}
          >
            US AQI (EPA)
          </button>
          <button
            type="button"
            aria-pressed={selectedScale === 'european_aqi'}
            onClick={() => onSelectScale('european_aqi')}
            className={`min-h-11 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${
              selectedScale === 'european_aqi'
                ? 'bg-[#0F5132] text-white'
                : 'text-slate-800 hover:bg-white'
            }`}
          >
            European AQI (EEA)
          </button>
        </fieldset>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-12">
        <div
          className={`rounded-xl border p-6 lg:col-span-7 ${visual.surfaceClass}`}
          aria-live="polite"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-mono text-xs font-semibold tracking-wider text-slate-700 uppercase">
                {activeReading.scaleLabel} · {activeReading.authorityLabel}
              </p>
              <div className="flex items-baseline gap-3 pt-1">
                <span
                  data-testid="primary-aqi-value"
                  className={`font-mono text-5xl font-bold tracking-tight tabular-nums ${visual.textClass}`}
                >
                  {activeReading.value !== null ? activeReading.value : 'Unavailable'}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-lg font-bold ${visual.textClass}`}
                >
                  <ActiveIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{activeReading.category}</span>
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {activeReading.pollutionLevelLabel}
              </p>
            </div>
          </div>

          <dl className="mt-5 space-y-3 border-t border-slate-200/80 pt-4 text-sm text-slate-900">
            <div>
              <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                What this reading means
              </dt>
              <dd className="mt-0.5 leading-relaxed">{activeReading.meaning}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                Practical precautions
              </dt>
              <dd className="mt-0.5 leading-relaxed">{activeReading.precautionSummary}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                Methodology
              </dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-slate-700">
                {activeReading.methodologyNote}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col justify-between gap-4 lg:col-span-5">
          <div className="rounded-xl bg-slate-50 p-5">
            <p className="font-mono text-xs font-semibold tracking-wider text-slate-600 uppercase">
              Companion Scale · {companionReading.scaleLabel}
            </p>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span
                data-testid="companion-aqi-value"
                className="font-mono text-3xl font-bold tabular-nums text-slate-950"
              >
                {companionReading.value !== null ? companionReading.value : 'Unavailable'}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-semibold ${companionVisual.textClass}`}
              >
                <CompanionIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{companionReading.category}</span>
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">
              {companionReading.meaning}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-5">
            <p className="font-mono text-xs font-semibold tracking-wider text-slate-600 uppercase">
              Dominant Contributing Pollutant
            </p>
            {dominantPollutant.status === 'available' && dominantPollutant.abbreviation ? (
              <div className="mt-2 space-y-1.5">
                <p className="text-lg font-bold text-slate-950">
                  {dominantPollutant.fullName} ({dominantPollutant.abbreviation})
                </p>
                <p className="text-sm leading-relaxed text-slate-700">
                  {dominantPollutant.explanation}
                </p>
              </div>
            ) : (
              <div className="mt-2 space-y-1">
                <p className="text-base font-semibold text-slate-900">Unavailable</p>
                <p className="text-sm leading-relaxed text-slate-700">
                  {dominantPollutant.explanation}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
