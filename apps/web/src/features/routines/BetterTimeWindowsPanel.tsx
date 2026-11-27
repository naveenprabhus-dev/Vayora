import type { BetterTimeWindowsSummary } from '@uaqa/contracts';
import { Clock, AlertTriangle } from 'lucide-react';
import { SurfaceCard } from '../../components/index.ts';

export interface BetterTimeWindowsPanelProps {
  readonly betterTimeWindows: BetterTimeWindowsSummary;
}

function formatAqiRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min === null || min === undefined || max === null || max === undefined) {
    return 'Unavailable';
  }
  return min === max ? String(min) : `${min}–${max}`;
}

export function BetterTimeWindowsPanel({ betterTimeWindows }: BetterTimeWindowsPanelProps) {
  return (
    <SurfaceCard as="section" aria-labelledby="better-windows-heading">
      <div className="space-y-1.5 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 text-[#0F5132]">
          <Clock className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="font-mono text-xs font-semibold tracking-wider uppercase">
            AQI-Aware Activity Windows
          </p>
        </div>
        <h3 id="better-windows-heading" className="text-xl font-bold text-slate-950">
          Comparatively Better Outdoor Time Windows
        </h3>
        <p className="text-xs leading-relaxed text-slate-600">
          {betterTimeWindows.limitationDisclosure}
        </p>
      </div>

      {betterTimeWindows.status === 'unavailable' || betterTimeWindows.windows.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Clean-air time windows unavailable</p>
            <p className="mt-1 text-xs leading-relaxed">
              {betterTimeWindows.limitationDisclosure} No synthetic clean-air times are shown.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {betterTimeWindows.windows.map((win, index) => (
            <article
              key={win.id || `${win.startTimestamp}-${win.label}-${index}`}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <p className="font-mono text-xs font-semibold text-[#0F5132]">
                {win.dataBasis === 'stale_model_forecast'
                  ? 'Stale cached forecast window'
                  : 'Open-Meteo hourly forecast window'}
              </p>
              <h4 className="mt-1 text-base font-bold text-slate-950">{win.label}</h4>
              <p className="mt-1.5 font-mono text-xs text-slate-800 tabular-nums">
                US AQI: {formatAqiRange(win.usAqiMin, win.usAqiMax)} · European AQI:{' '}
                {formatAqiRange(win.europeanAqiMin, win.europeanAqiMax)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">{win.rationale}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Limitation: {win.cautionNote}
              </p>
            </article>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
