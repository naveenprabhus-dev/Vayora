import type { PollutantDetail } from '@uaqa/contracts';
import { SurfaceCard } from '../../components/index.ts';
import { getPollutantBandVisual } from './severityStyles.ts';

export interface PollutantOverviewGridProps {
  readonly pollutants: readonly PollutantDetail[];
}

export function PollutantOverviewGrid({ pollutants }: PollutantOverviewGridProps) {
  return (
    <SurfaceCard as="section" aria-labelledby="pollutants-overview-heading">
      <div className="space-y-1 border-b border-slate-200 pb-4">
        <h2 id="pollutants-overview-heading" className="text-xl font-bold text-slate-950">
          Tracked Pollutant Concentrations
        </h2>
        <p className="text-sm text-slate-600">
          Individual mass concentrations in µg/m³ are reported separately from composite AQI scores
          and are never averaged together.
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pollutants.map((pollutant) => {
          const bandVisual = getPollutantBandVisual(pollutant.concentrationBand);
          const BandIcon = bandVisual.Icon;

          return (
            <article
              key={pollutant.code}
              className="flex flex-col justify-between rounded-lg bg-slate-50 p-4"
              aria-label={`${pollutant.fullName} (${pollutant.abbreviation})`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold tracking-wider text-slate-600 uppercase">
                      {pollutant.abbreviation}
                    </p>
                    <h3 className="text-base font-bold text-slate-950">{pollutant.fullName}</h3>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${bandVisual.textClass}`}
                  >
                    <BandIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{pollutant.concentrationBandLabel}</span>
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span
                    data-testid={`pollutant-value-${pollutant.code}`}
                    className="font-mono text-2xl font-bold tabular-nums text-slate-950"
                  >
                    {pollutant.concentration !== null
                      ? pollutant.concentration.toFixed(1)
                      : 'Unavailable'}
                  </span>
                  {pollutant.concentration !== null ? (
                    <span className="font-mono text-xs font-medium text-slate-600">
                      {pollutant.unit}
                    </span>
                  ) : null}
                </div>
              </div>

              <p className="mt-3 border-t border-slate-200/80 pt-3 text-xs leading-relaxed text-slate-700">
                {pollutant.explanation}
              </p>
            </article>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
