import type { AirPurifierGuidanceSummary, VentilationGuidanceSummary } from '@uaqa/contracts';
import { Filter, ShieldCheck } from 'lucide-react';
import { SurfaceCard } from '../../components/index.ts';
import { getEvidenceCategoryVisual, getVentilationStateVisual } from './indoorStyles.ts';

export interface VentilationAndPurifierSectionProps {
  readonly ventilationGuidance: VentilationGuidanceSummary;
  readonly purifierGuidance: AirPurifierGuidanceSummary;
}

export function VentilationAndPurifierSection({
  ventilationGuidance,
  purifierGuidance,
}: VentilationAndPurifierSectionProps) {
  const ventVisual = getVentilationStateVisual(ventilationGuidance.state);
  const VentIcon = ventVisual.Icon;
  const ventCategory = getEvidenceCategoryVisual(ventilationGuidance.informationCategory);
  const purifierCategory = getEvidenceCategoryVisual(purifierGuidance.informationCategory);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Ventilation Guidance */}
      <SurfaceCard as="section" aria-labelledby="indoor-ventilation-heading">
        <div className="space-y-2 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
            <span className={`inline-flex items-center gap-1.5 ${ventVisual.textClass}`}>
              <VentIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{ventVisual.label}</span>
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className={ventCategory.textClass}>{ventCategory.shortLabel}</span>
          </div>

          <h3 id="indoor-ventilation-heading" className="text-xl font-bold text-slate-950">
            {ventilationGuidance.headline}
          </h3>
          <p className="text-xs font-semibold text-slate-700">{ventilationGuidance.stateLabel}</p>
        </div>

        <div className="mt-4 space-y-4 text-sm text-slate-800">
          <p className="leading-relaxed">{ventilationGuidance.summary}</p>

          {ventilationGuidance.bestWindowHint ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <p className="font-semibold text-slate-950">
                Forecast window hint: {ventilationGuidance.bestWindowHint}
              </p>
              <p className="mt-1 text-slate-700">{ventilationGuidance.windowDisclosure}</p>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-slate-600">
              {ventilationGuidance.windowDisclosure}
            </p>
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950">
            <p className="inline-flex items-center gap-1.5 font-bold">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Essential ventilation &amp; combustion safety</span>
            </p>
            <p className="mt-1 leading-relaxed">{ventilationGuidance.essentialSafetyReminder}</p>
          </div>

          <div>
            <h4 className="text-xs font-bold tracking-wide text-slate-700 uppercase">
              Constraints &amp; limitations
            </h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-700">
              {ventilationGuidance.constraintsAndTradeoffs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </SurfaceCard>

      {/* Air Purifier Guidance */}
      <SurfaceCard as="section" aria-labelledby="indoor-purifier-heading">
        <div className="space-y-2 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 text-[#0F5132]">
              <Filter className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {purifierGuidance.hasPurifier
                  ? 'HEPA purifier reported'
                  : purifierGuidance.scenarioSimulatedPurifier
                    ? 'Simulated HEPA purifier'
                    : 'Non-purifier alternatives'}
              </span>
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className={purifierCategory.textClass}>{purifierCategory.shortLabel}</span>
          </div>

          <h3 id="indoor-purifier-heading" className="text-xl font-bold text-slate-950">
            {purifierGuidance.headline}
          </h3>
          <p className="text-sm leading-relaxed text-slate-700">{purifierGuidance.summary}</p>
        </div>

        <div className="mt-4 space-y-4 text-sm text-slate-800">
          <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-slate-800">
            {purifierGuidance.practicalGuidance.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>

          <div
            data-testid="hepa-gas-limitation"
            className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-800"
          >
            <p className="font-bold text-slate-950">Particle-only filtration boundary</p>
            <p className="mt-1 leading-relaxed">{purifierGuidance.gasAndVocLimitation}</p>
          </div>

          {purifierGuidance.nonPurchaseNote ? (
            <p className="text-xs leading-relaxed text-slate-600">
              {purifierGuidance.nonPurchaseNote}
            </p>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
