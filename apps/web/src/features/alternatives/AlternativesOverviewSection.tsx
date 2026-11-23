import type {
  AlternativeAffordabilityTier,
  AlternativeCategory,
  AlternativeImpactClassification,
  AlternativeRelevanceScope,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import { RefreshCw } from 'lucide-react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import { formatIsoTimestamp } from '../air-quality/severityStyles.ts';
import {
  COMMUTE_MODE_OPTIONS,
  HEATING_OPTIONS,
  LOCATION_ZONE_OPTIONS,
  findOptionLabel,
} from '../onboarding/options.ts';
import { getImpactClassificationVisual } from './alternativesStyles.ts';

export type CategoryFilter = 'all' | AlternativeCategory;
export type AffordabilityFilter = 'all' | AlternativeAffordabilityTier;
export type RelevanceFilter = 'all' | AlternativeRelevanceScope;
export type ImpactClassificationFilter = 'all' | AlternativeImpactClassification;
export type PracticalityFilter = 'all' | 'recommended' | 'conditional';

export interface AlternativesOverviewSectionProps {
  readonly data: SustainableAlternativesResponse;
  readonly categoryFilter: CategoryFilter;
  readonly affordabilityFilter: AffordabilityFilter;
  readonly relevanceFilter: RelevanceFilter;
  readonly impactFilter: ImpactClassificationFilter;
  readonly practicalityFilter: PracticalityFilter;
  readonly isRefreshing: boolean;
  readonly onSelectCategory: (value: CategoryFilter) => void;
  readonly onSelectAffordability: (value: AffordabilityFilter) => void;
  readonly onSelectRelevance: (value: RelevanceFilter) => void;
  readonly onSelectImpact: (value: ImpactClassificationFilter) => void;
  readonly onSelectPracticality: (value: PracticalityFilter) => void;
  readonly onResetFilters: () => void;
  readonly onRefresh: () => void;
}

const CATEGORY_FILTER_OPTIONS: readonly {
  readonly value: CategoryFilter;
  readonly label: string;
}[] = [
  { value: 'all', label: 'All categories' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'household_energy_heating', label: 'Energy & Heating' },
  { value: 'everyday_activities', label: 'Everyday Activities' },
  { value: 'consumption_waste', label: 'Consumption & Waste' },
];

const AFFORDABILITY_FILTER_OPTIONS: readonly {
  readonly value: AffordabilityFilter;
  readonly label: string;
}[] = [
  { value: 'all', label: 'All cost levels' },
  { value: 'zero_cost', label: 'No added cost' },
  { value: 'low_cost', label: 'Low cost' },
  { value: 'moderate_investment', label: 'Moderate investment' },
];

const RELEVANCE_FILTER_OPTIONS: readonly {
  readonly value: RelevanceFilter;
  readonly label: string;
}[] = [
  { value: 'all', label: 'Indoor & outdoor' },
  { value: 'indoor', label: 'Indoor only' },
  { value: 'outdoor', label: 'Outdoor only' },
  { value: 'both', label: 'Indoor & outdoor mix' },
];

const IMPACT_FILTER_OPTIONS: readonly {
  readonly value: ImpactClassificationFilter;
  readonly label: string;
}[] = [
  { value: 'all', label: 'All impact types' },
  { value: 'local_emissions', label: 'Local emissions' },
  { value: 'personal_exposure', label: 'Personal exposure' },
  { value: 'both_exposure_and_emissions', label: 'Both exposure & emissions' },
  { value: 'broader_sustainability', label: 'Broader sustainability' },
];

const PRACTICALITY_FILTER_OPTIONS: readonly {
  readonly value: PracticalityFilter;
  readonly label: string;
}[] = [
  { value: 'all', label: 'All suitability states' },
  { value: 'recommended', label: 'Suitable now' },
  { value: 'conditional', label: 'Conditional only' },
];

export function AlternativesOverviewSection({
  data,
  categoryFilter,
  affordabilityFilter,
  relevanceFilter,
  impactFilter,
  practicalityFilter,
  isRefreshing,
  onSelectCategory,
  onSelectAffordability,
  onSelectRelevance,
  onSelectImpact,
  onSelectPracticality,
  onResetFilters,
  onRefresh,
}: AlternativesOverviewSectionProps) {
  const { overview, location, airQualityContext } = data;
  const { transparency } = airQualityContext;

  const hasActiveFilters =
    categoryFilter !== 'all' ||
    affordabilityFilter !== 'all' ||
    relevanceFilter !== 'all' ||
    impactFilter !== 'all' ||
    practicalityFilter !== 'all';

  return (
    <SurfaceCard as="section" aria-labelledby="sustainable-alternatives-heading">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-xs font-medium tracking-wider text-[#0F5132] uppercase">
            VAYORA · Sustainable Alternatives Advisor
          </p>
          <h2
            id="sustainable-alternatives-heading"
            className="text-2xl font-bold tracking-tight text-slate-950"
          >
            {overview.headline}
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-700">{overview.summary}</p>
          <p className="text-xs text-slate-600">
            Location: {location.neighborhood}, {location.city}, {location.country} · Zone:{' '}
            {findOptionLabel(LOCATION_ZONE_OPTIONS, overview.householdSummary.primaryZoneType)} ·
            Generated{' '}
            <time dateTime={data.generatedAt} className="font-mono tabular-nums text-slate-900">
              {formatIsoTimestamp(data.generatedAt, location.timezone)}
            </time>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" isLoading={isRefreshing} onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isRefreshing ? 'Refreshing...' : 'Refresh alternatives'}
          </Button>
        </div>
      </div>

      {/* Telemetry & Active Travel AQI Safeguard Banner */}
      {transparency.freshnessStatus === 'stale' ? (
        <div className="mt-5">
          <AlertBanner tone="warning" title="Outdoor telemetry is stale cached data">
            <p>
              {transparency.fallbackReason ??
                'Live outdoor readings could not be refreshed; cached readings remain in use.'}{' '}
              {overview.activeTransportAqiNote}
            </p>
          </AlertBanner>
        </div>
      ) : null}

      {transparency.freshnessStatus === 'unavailable' ? (
        <div className="mt-5">
          <AlertBanner
            tone="warning"
            title="Live outdoor AQI unavailable — active travel marked conditional"
          >
            <p>{overview.activeTransportAqiNote}</p>
          </AlertBanner>
        </div>
      ) : null}

      {transparency.freshnessStatus === 'fresh' ? (
        <div className="mt-5">
          <AlertBanner tone="info" title="Air-quality & practicality context">
            <p>{overview.activeTransportAqiNote}</p>
          </AlertBanner>
        </div>
      ) : null}

      {/* Household context & counts */}
      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Saved commute mode</dt>
          <dd className="mt-1 text-sm font-bold text-slate-950">
            {findOptionLabel(COMMUTE_MODE_OPTIONS, overview.householdSummary.primaryCommuteMode)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Saved heating setup</dt>
          <dd className="mt-1 text-sm font-bold text-slate-950">
            {findOptionLabel(HEATING_OPTIONS, overview.householdSummary.heatingType)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Matched alternatives</dt>
          <dd className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-950">
            {overview.matchedAlternativesCount} of {overview.totalCatalogEvaluated} tailored
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Outdoor AQI status</dt>
          <dd className="mt-1 text-sm font-bold text-slate-950">
            {airQualityContext.usAqi.value !== null
              ? `US AQI ${airQualityContext.usAqi.value} (${airQualityContext.usAqi.category})`
              : 'Unavailable'}
          </dd>
        </div>
      </dl>

      {/* Four-way Impact Distinction Legend */}
      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="text-sm font-bold tracking-wide text-slate-950 uppercase">
          Impact Distinction: Emissions vs Exposure vs Broader Sustainability
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {overview.impactDistinctionLegend.map((entry) => {
            const visual = getImpactClassificationVisual(entry.classification);
            const Icon = visual.Icon;
            return (
              <div
                key={entry.classification}
                data-testid={`impact-legend-${entry.classification}`}
                className="rounded-lg border border-slate-200 bg-white p-3.5"
              >
                <p
                  className={`inline-flex items-center gap-1.5 text-xs font-bold ${visual.textClass}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{entry.label}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">{entry.summary}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {entry.localPollutantRelevance}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Filter Controls */}
      <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-950">Filter household alternatives</h3>
          {hasActiveFilters ? (
            <Button type="button" variant="secondary" onClick={onResetFilters}>
              Reset all filters
            </Button>
          ) : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-700">Category</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_FILTER_OPTIONS.map((option) => {
              const selected = categoryFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  disabled={isRefreshing}
                  onClick={() => onSelectCategory(option.value)}
                  className={`min-h-11 rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-60 ${
                    selected
                      ? 'border-[#0F5132] bg-[#0F5132] text-white'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Affordability &amp; cost</span>
            <select
              aria-label="Filter by affordability"
              value={affordabilityFilter}
              onChange={(event) => onSelectAffordability(event.target.value as AffordabilityFilter)}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
            >
              {AFFORDABILITY_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Setting / relevance</span>
            <select
              aria-label="Filter by indoor or outdoor relevance"
              value={relevanceFilter}
              onChange={(event) => onSelectRelevance(event.target.value as RelevanceFilter)}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
            >
              {RELEVANCE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Impact benefit type</span>
            <select
              aria-label="Filter by impact benefit type"
              value={impactFilter}
              onChange={(event) => onSelectImpact(event.target.value as ImpactClassificationFilter)}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
            >
              {IMPACT_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Practicality &amp; AQI suitability</span>
            <select
              aria-label="Filter by practicality"
              value={practicalityFilter}
              onChange={(event) => onSelectPracticality(event.target.value as PracticalityFilter)}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
            >
              {PRACTICALITY_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </SurfaceCard>
  );
}
