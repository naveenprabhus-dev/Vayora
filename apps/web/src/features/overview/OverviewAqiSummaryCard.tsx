import type { AirQualityCurrentResponse } from '@uaqa/contracts';
import { ArrowRight } from 'lucide-react';
import { buildWorkspaceUrl } from '../../app/routing.ts';
import { AlertBanner, SurfaceCard } from '../../components/index.ts';
import { formatIsoTimestamp, getAqiSeverityVisual } from '../air-quality/severityStyles.ts';
import type { WorkspacePageId } from '../navigation/navConfig.ts';
import { handleWorkspaceLinkClick } from '../navigation/navigationUtils.ts';

export interface OverviewAqiSummaryCardProps {
  readonly city: string;
  readonly aqData: AirQualityCurrentResponse | null;
  readonly aqError: string | null;
  readonly isLoadingAq: boolean;
  readonly onNavigate: (pageId: WorkspacePageId) => void;
}

export function OverviewAqiSummaryCard({
  city,
  aqData,
  aqError,
  isLoadingAq,
  onNavigate,
}: OverviewAqiSummaryCardProps) {
  const usAqi = aqData?.aqi.usAqi;
  const euAqi = aqData?.aqi.europeanAqi;
  const usVisual = getAqiSeverityVisual(usAqi?.severityToken ?? 'unavailable');
  const UsIcon = usVisual.Icon;

  return (
    <SurfaceCard
      as="section"
      aria-labelledby="overview-aqi-heading"
      className="flex flex-col justify-between lg:col-span-5"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 id="overview-aqi-heading" className="text-lg font-bold text-slate-950">
              Current AQI Summary
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {aqData
                ? `Observed ${formatIsoTimestamp(aqData.transparency.observationTimestamp, aqData.location.timezone)}`
                : `Resolving conditions for ${city}`}
            </p>
          </div>
        </div>

        {isLoadingAq && !aqData ? (
          <output aria-live="polite" className="block py-4 text-sm text-slate-700">
            Loading current air quality index for {city}...
          </output>
        ) : aqError && !aqData ? (
          <AlertBanner tone="error" title="Current AQI unavailable">
            <p>{aqError}</p>
          </AlertBanner>
        ) : aqData && usAqi && euAqi ? (
          <div className="space-y-4">
            {aqData.transparency.freshnessStatus !== 'fresh' ? (
              <AlertBanner
                tone="warning"
                title={
                  aqData.transparency.freshnessStatus === 'stale'
                    ? 'Stale cached AQI reading'
                    : 'Live AQI temporarily unavailable'
                }
              >
                <p>
                  {aqData.transparency.fallbackReason ??
                    'Live telemetry is temporarily unavailable; no placeholder numbers are fabricated.'}
                </p>
              </AlertBanner>
            ) : null}

            <div className={`rounded-xl border p-4 ${usVisual.surfaceClass}`}>
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-700">US AQI (EPA)</p>
                  <p
                    data-testid="overview-us-aqi-value"
                    className={`mt-1 font-mono text-4xl font-bold tabular-nums ${usVisual.textClass}`}
                  >
                    {usAqi.value !== null ? usAqi.value : 'Unavailable'}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-bold ${usVisual.textClass}`}
                  >
                    <UsIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{usAqi.category}</span>
                  </span>
                  <p className="mt-1 font-mono text-xs text-slate-700 tabular-nums">
                    EEA AQI:{' '}
                    {euAqi.value !== null ? `${euAqi.value} (${euAqi.category})` : 'Unavailable'}
                  </p>
                </div>
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-xs font-medium text-slate-600">Dominant pollutant</dt>
                <dd className="font-semibold text-slate-950">
                  {aqData.aqi.dominantPollutant.status === 'available' &&
                  aqData.aqi.dominantPollutant.abbreviation
                    ? `${aqData.aqi.dominantPollutant.fullName} (${aqData.aqi.dominantPollutant.abbreviation})`
                    : 'Unavailable'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-xs font-medium text-slate-600">Data basis</dt>
                <dd className="text-xs text-slate-700">
                  {aqData.transparency.providerName} · Model forecast
                </dd>
              </div>
            </dl>
            <p className="text-xs leading-relaxed text-slate-700">{usAqi.precautionSummary}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <a
          href={buildWorkspaceUrl('air-quality')}
          onClick={(e) => handleWorkspaceLinkClick(e, 'air-quality', onNavigate)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F5132] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
        >
          <span>Inspect pollutants &amp; 48h forecast</span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
      </div>
    </SurfaceCard>
  );
}
