import type { AirQualityLocationSummary, DataTransparencyInfo } from '@uaqa/contracts';
import { Database } from 'lucide-react';
import { SurfaceCard } from '../../components/index.ts';
import { formatIsoTimestamp } from './severityStyles.ts';

export interface DataTransparencyPanelProps {
  readonly transparency: DataTransparencyInfo;
  readonly location: AirQualityLocationSummary;
}

const FRESHNESS_DISPLAY: Readonly<Record<DataTransparencyInfo['freshnessStatus'], string>> = {
  fresh: 'Fresh (within live cache window)',
  stale: 'Stale cached fallback (upstream temporarily unreachable)',
  unavailable: 'Unavailable (no live or valid cached data)',
};

export function DataTransparencyPanel({ transparency, location }: DataTransparencyPanelProps) {
  return (
    <SurfaceCard as="section" aria-labelledby="data-transparency-heading">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
        <Database className="h-5 w-5 shrink-0 text-[#0F5132]" aria-hidden="true" />
        <div>
          <h2 id="data-transparency-heading" className="text-lg font-bold text-slate-950">
            Data Source, Freshness &amp; Methodology Disclosure
          </h2>
          <p className="text-xs text-slate-600">{transparency.dataNatureDisclosure}</p>
        </div>
      </div>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs font-medium text-slate-600">Upstream provider &amp; license</dt>
          <dd className="font-medium text-slate-950">
            {transparency.providerName} · {transparency.attribution}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-600">Data nature</dt>
          <dd className="font-medium text-slate-950">
            {transparency.dataNature === 'model_forecast'
              ? 'Model-generated forecast & dispersion estimate'
              : 'Unavailable'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-600">Freshness &amp; availability</dt>
          <dd className="font-medium text-slate-950">
            {FRESHNESS_DISPLAY[transparency.freshnessStatus]} ({transparency.availabilityStatus})
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-600">Model observation timestamp</dt>
          <dd className="font-mono text-xs tabular-nums text-slate-950">
            {formatIsoTimestamp(transparency.observationTimestamp, location.timezone)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-600">Retrieved at</dt>
          <dd className="font-mono text-xs tabular-nums text-slate-950">
            {formatIsoTimestamp(transparency.fetchedAt, location.timezone)}
            {transparency.cacheAgeSeconds !== null
              ? ` (cache age: ${transparency.cacheAgeSeconds}s)`
              : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-600">Index methodology</dt>
          <dd className="text-xs leading-relaxed text-slate-700">
            {transparency.methodologySummary}
          </dd>
        </div>
      </dl>
    </SurfaceCard>
  );
}
