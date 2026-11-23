import type { CommuteStrategySummary } from '@uaqa/contracts';
import { Route } from 'lucide-react';
import { SurfaceCard } from '../../components/index.ts';
import { getImpactTypeVisual, getRoutineStatusVisual } from './routineStyles.ts';

export interface CommuteStrategyPanelProps {
  readonly commuteSummary: CommuteStrategySummary;
}

export function CommuteStrategyPanel({ commuteSummary }: CommuteStrategyPanelProps) {
  return (
    <SurfaceCard as="section" aria-labelledby="commute-strategy-heading">
      <div className="space-y-2 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 text-[#0F5132]">
          <Route className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="font-mono text-xs font-semibold tracking-wider uppercase">
            Commute Strategy
          </p>
        </div>
        <h3 id="commute-strategy-heading" className="text-xl font-bold text-slate-950">
          {commuteSummary.headline}
        </h3>
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
          <strong className="font-semibold text-slate-950">Emissions vs. personal exposure:</strong>{' '}
          {commuteSummary.exposureVsEmissionsNote}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {commuteSummary.options.map((option) => {
          const statusVisual = getRoutineStatusVisual(option.status);
          const impactVisual = getImpactTypeVisual(option.impactType);
          const StatusIcon = statusVisual.Icon;
          const ImpactIcon = impactVisual.Icon;

          return (
            <article
              key={option.id}
              data-testid={`commute-option-${option.id}`}
              className={`rounded-lg border p-4 ${statusVisual.surfaceClass}`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
                <span className={`inline-flex items-center gap-1 ${statusVisual.textClass}`}>
                  <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{statusVisual.label}</span>
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span className={`inline-flex items-center gap-1 ${impactVisual.textClass}`}>
                  <ImpactIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{option.impactLabel}</span>
                </span>
              </div>

              <h4 className="mt-2 text-base font-bold text-slate-950">{option.modeLabel}</h4>
              <p className="mt-1 text-sm leading-relaxed text-slate-800">{option.summary}</p>
              <dl className="mt-3 space-y-1.5 border-t border-slate-200/80 pt-2.5 text-xs text-slate-700">
                <div>
                  <dt className="inline font-semibold text-slate-900">Why: </dt>
                  <dd className="inline">{option.reason}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-slate-900">Status note: </dt>
                  <dd className="inline">{option.statusReason}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-slate-900">Local infrastructure: </dt>
                  <dd className="inline">{option.infrastructureNote}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
