import type {
  CommuteMode,
  DailyRoutineResponse,
  OutdoorActivityPattern,
  RoutineImpactType,
  RoutineTimePeriod,
} from '@uaqa/contracts';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { AlertBanner, Button, SelectField, SurfaceCard } from '../../components/index.ts';
import {
  COMMUTE_MODE_OPTIONS,
  OUTDOOR_PATTERN_OPTIONS,
  findOptionLabel,
} from '../onboarding/options.ts';
import { formatIsoTimestamp } from '../air-quality/severityStyles.ts';

export type ImpactFilter = 'all' | RoutineImpactType;
export type PeriodFilter = 'all' | RoutineTimePeriod;

export interface RoutineOverviewSectionProps {
  readonly data: DailyRoutineResponse;
  readonly impactFilter: ImpactFilter;
  readonly periodFilter: PeriodFilter;
  readonly isRefreshing: boolean;
  readonly onSelectImpactFilter: (next: ImpactFilter) => void;
  readonly onSelectPeriodFilter: (next: PeriodFilter) => void;
  readonly onChangeScenario: (next: {
    readonly commuteMode?: CommuteMode;
    readonly outdoorActivityPattern?: OutdoorActivityPattern;
  }) => void;
  readonly onResetScenario: () => void;
  readonly onRefresh: () => void;
}

const IMPACT_FILTER_OPTIONS: ReadonlyArray<{
  readonly value: ImpactFilter;
  readonly label: string;
}> = [
  { value: 'all', label: 'All actions' },
  { value: 'exposure_reduction', label: 'Personal exposure' },
  { value: 'emission_reduction', label: 'Local emissions' },
  { value: 'both', label: 'Exposure & emissions' },
];

const PERIOD_FILTER_OPTIONS: ReadonlyArray<{
  readonly value: PeriodFilter;
  readonly label: string;
}> = [
  { value: 'all', label: 'Full day' },
  { value: 'morning', label: 'Morning' },
  { value: 'midday', label: 'Midday' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
];

export function RoutineOverviewSection({
  data,
  impactFilter,
  periodFilter,
  isRefreshing,
  onSelectImpactFilter,
  onSelectPeriodFilter,
  onChangeScenario,
  onResetScenario,
  onRefresh,
}: RoutineOverviewSectionProps) {
  const { overview, profileContext, airQualityContext, location } = data;
  const { transparency } = airQualityContext;

  return (
    <SurfaceCard as="section" aria-labelledby="daily-routines-heading">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-xs font-medium tracking-wider text-[#0F5132] uppercase">
            VAYORA · Low-Emission Daily Routines
          </p>
          <h2
            id="daily-routines-heading"
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight text-slate-950 focus:outline-none"
          >
            {overview.headline}
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-700">{overview.summary}</p>
          <p className="text-xs text-slate-600">
            Location: {location.neighborhood}, {location.city}, {location.country} · Commute:{' '}
            {findOptionLabel(COMMUTE_MODE_OPTIONS, profileContext.effectiveCommuteMode)} · Outdoor
            pattern:{' '}
            {findOptionLabel(OUTDOOR_PATTERN_OPTIONS, profileContext.effectiveOutdoorPattern)} ·
            Generated{' '}
            <time dateTime={data.generatedAt} className="font-mono tabular-nums text-slate-900">
              {formatIsoTimestamp(data.generatedAt, location.timezone)}
            </time>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" isLoading={isRefreshing} onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isRefreshing ? 'Refreshing...' : 'Refresh routines'}
          </Button>
        </div>
      </div>

      {transparency.freshnessStatus === 'stale' ? (
        <div className="mt-5">
          <AlertBanner
            tone="warning"
            title="Routines generated from stale cached air quality telemetry"
          >
            <p>
              {transparency.fallbackReason ??
                'Live telemetry could not be refreshed; cached readings remain in use.'}{' '}
              Time windows and exposure thresholds carry higher uncertainty until fresh data
              resumes.
            </p>
          </AlertBanner>
        </div>
      ) : null}

      {transparency.freshnessStatus === 'unavailable' ? (
        <div className="mt-5">
          <AlertBanner
            tone="warning"
            title="Live telemetry unavailable — baseline clean-air routine active"
          >
            <p>
              No live AQI or hourly forecast numbers are fabricated. Forecast-dependent time windows
              are marked unavailable, while practical household and low-emission habits remain
              shown.
            </p>
          </AlertBanner>
        </div>
      ) : null}

      {profileContext.isScenarioPreview ? (
        <div className="mt-5">
          <AlertBanner tone="info" title="Scenario comparison active (saved preferences unchanged)">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                Comparing{' '}
                <strong>
                  {findOptionLabel(COMMUTE_MODE_OPTIONS, profileContext.effectiveCommuteMode)}
                </strong>{' '}
                and{' '}
                <strong>
                  {findOptionLabel(OUTDOOR_PATTERN_OPTIONS, profileContext.effectiveOutdoorPattern)}
                </strong>{' '}
                against your saved household profile.
              </p>
              <Button type="button" variant="secondary" onClick={onResetScenario}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset to saved preferences
              </Button>
            </div>
          </AlertBanner>
        </div>
      ) : null}

      <dl className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Recommended</dt>
          <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-950">
            {overview.totalRecommended}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Optional</dt>
          <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {overview.totalOptional}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Unavailable</dt>
          <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-950">
            {overview.totalUnavailable}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Exposure-focused</dt>
          <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-sky-900">
            {overview.exposureCount}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Emission-focused</dt>
          <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-900">
            {overview.emissionCount}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Both benefits</dt>
          <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0F5132]">
            {overview.bothCount}
          </dd>
        </div>
      </dl>

      <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 lg:grid-cols-2">
        <SelectField
          id="routine-scenario-commute"
          label="Preview commute mode scenario"
          hint="Defaults to your saved household commute mode; changing this previews commute guidance without overwriting saved preferences."
          value={profileContext.effectiveCommuteMode}
          options={COMMUTE_MODE_OPTIONS}
          onChange={(e) => onChangeScenario({ commuteMode: e.target.value as CommuteMode })}
        />
        <SelectField
          id="routine-scenario-outdoor"
          label="Preview outdoor activity pattern"
          hint="Explore how shifting outdoor timing affects your daily routine schedule."
          value={profileContext.effectiveOutdoorPattern}
          options={OUTDOOR_PATTERN_OPTIONS}
          onChange={(e) =>
            onChangeScenario({ outdoorActivityPattern: e.target.value as OutdoorActivityPattern })
          }
        />
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-5 lg:flex-row lg:items-center lg:justify-between">
        <fieldset className="flex flex-wrap gap-1 rounded-lg border border-slate-300 bg-slate-100 p-1">
          <legend className="sr-only">Filter routines by benefit type</legend>
          {IMPACT_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={impactFilter === option.value}
              onClick={() => onSelectImpactFilter(option.value)}
              className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                impactFilter === option.value
                  ? 'bg-[#0F5132] text-white'
                  : 'text-slate-800 hover:bg-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </fieldset>

        <fieldset className="flex flex-wrap gap-1 rounded-lg border border-slate-300 bg-slate-100 p-1">
          <legend className="sr-only">Filter routines by part of day</legend>
          {PERIOD_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={periodFilter === option.value}
              onClick={() => onSelectPeriodFilter(option.value)}
              className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                periodFilter === option.value
                  ? 'bg-[#0F5132] text-white'
                  : 'text-slate-800 hover:bg-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-600">{overview.safetyAndScopeNotice}</p>
    </SurfaceCard>
  );
}
