import type { IndoorAirGuidanceResponse, IndoorScenarioId } from '@uaqa/contracts';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import {
  HEATING_OPTIONS,
  LOCATION_ZONE_OPTIONS,
  VENTILATION_OPTIONS,
  findOptionLabel,
} from '../onboarding/options.ts';
import { formatIsoTimestamp } from '../air-quality/severityStyles.ts';
import { getEvidenceCategoryVisual } from './indoorStyles.ts';

export interface IndoorEnvironmentSectionProps {
  readonly data: IndoorAirGuidanceResponse;
  readonly isRefreshing: boolean;
  readonly onSelectScenario: (scenario: IndoorScenarioId) => void;
  readonly onRefresh: () => void;
}

export function IndoorEnvironmentSection({
  data,
  isRefreshing,
  onSelectScenario,
  onRefresh,
}: IndoorEnvironmentSectionProps) {
  const { overview, airQualityContext, scenarioContext, location } = data;
  const { transparency } = airQualityContext;

  return (
    <SurfaceCard as="section" aria-labelledby="indoor-air-heading">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-xs font-medium tracking-wider text-[#0F5132] uppercase">
            VAYORA · Indoor Air Quality Assistant
          </p>
          <h2
            id="indoor-air-heading"
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight text-slate-950 focus:outline-none"
          >
            {overview.headline}
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-700">{overview.summary}</p>
          <p className="text-xs text-slate-600">
            Location: {location.neighborhood}, {location.city}, {location.country} · Zone:{' '}
            {findOptionLabel(LOCATION_ZONE_OPTIONS, overview.primaryZoneType)} · Generated{' '}
            <time dateTime={data.generatedAt} className="font-mono tabular-nums text-slate-900">
              {formatIsoTimestamp(data.generatedAt, location.timezone)}
            </time>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" isLoading={isRefreshing} onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isRefreshing ? 'Refreshing...' : 'Refresh indoor guidance'}
          </Button>
        </div>
      </div>

      {/* Mandatory missing indoor sensor disclosure */}
      <div className="mt-5" data-testid="indoor-sensor-disclosure">
        <AlertBanner tone="info" title="No indoor air sensors connected">
          <p className="font-medium">{overview.sensorStatus.disclosureStatement}</p>
        </AlertBanner>
      </div>

      {transparency.freshnessStatus === 'stale' ? (
        <div className="mt-4">
          <AlertBanner tone="warning" title="Outdoor telemetry is stale cached data">
            <p>
              {transparency.fallbackReason ??
                'Live outdoor readings could not be refreshed; cached readings remain in use.'}{' '}
              Verify visible outdoor conditions before prolonged optional airing.
            </p>
          </AlertBanner>
        </div>
      ) : null}

      {transparency.freshnessStatus === 'unavailable' ? (
        <div className="mt-4">
          <AlertBanner
            tone="warning"
            title="Live outdoor telemetry unavailable — safety & educational guidance active"
          >
            <p>
              No indoor or outdoor measurements are fabricated. Ventilation recommendations reflect
              insufficient outdoor data until live telemetry resumes.
            </p>
          </AlertBanner>
        </div>
      ) : null}

      {/* Saved household indoor environment summary */}
      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Ventilation setup</dt>
          <dd className="mt-1 text-sm font-bold text-slate-950">
            {findOptionLabel(VENTILATION_OPTIONS, overview.ventilationContext)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Indoor HEPA purifier</dt>
          <dd className="mt-1 text-sm font-bold text-slate-950">
            {overview.hasIndoorAirPurifier ? 'Reported available' : 'Not reported'}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Primary heating</dt>
          <dd className="mt-1 text-sm font-bold text-slate-950">
            {findOptionLabel(HEATING_OPTIONS, overview.heatingType)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs font-medium text-slate-600">Household occupancy</dt>
          <dd className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-950">
            {overview.householdSize} {overview.householdSize === 1 ? 'member' : 'members'}
          </dd>
        </div>
      </dl>

      {/* Four-way Information Distinction Matrix */}
      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="text-sm font-bold tracking-wide text-slate-950 uppercase">
          Information Basis &amp; Measurement Distinction
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {overview.sensorStatus.evidenceDistinctions.map((entry) => {
            const visual = getEvidenceCategoryVisual(entry.category);
            const Icon = visual.Icon;
            return (
              <div
                key={entry.category}
                data-testid={`evidence-distinction-${entry.category}`}
                className="rounded-lg border border-slate-200 bg-white p-3.5"
              >
                <p
                  className={`inline-flex items-center gap-1.5 text-xs font-bold ${visual.textClass}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{entry.label}</span>
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-900">{entry.statusLabel}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{entry.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scenario Explorer */}
      <div className="mt-6 border-t border-slate-200 pt-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-bold text-slate-950">
            Explore an indoor activity scenario (illustrative simulation)
          </legend>
          <div className="flex flex-wrap gap-2">
            {scenarioContext.availableScenarios.map((option) => {
              const selected = scenarioContext.selectedScenario === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={isRefreshing}
                  onClick={() => onSelectScenario(option.id)}
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

        {scenarioContext.isSimulation ? (
          <div className="mt-4" data-testid="indoor-simulation-banner">
            <AlertBanner tone="info" title={scenarioContext.scenarioTitle}>
              <p className="font-medium">{scenarioContext.simulationLabel}</p>
              <p className="mt-1">{scenarioContext.scenarioDescription}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
                {scenarioContext.scenarioFocusNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </AlertBanner>
          </div>
        ) : null}

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-600">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" aria-hidden="true" />
          <span>{data.provenanceAndSafety.nonMedicalNotice}</span>
        </p>
      </div>
    </SurfaceCard>
  );
}
