import type {
  CommuteMode,
  HouseholdLifestyleRecord,
  OutdoorActivityPattern,
} from '@uaqa/contracts';
import { useCallback, useState } from 'react';
import {
  AlertBanner,
  Button,
  SurfaceCard,
  WorkspaceErrorRetryBanner,
  WorkspaceLoadingCard,
} from '../../components/index.ts';
import { useWorkspaceResource } from '../../hooks/useWorkspaceResource.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import { buildProfileSyncKey } from '../../lib/profileSync.ts';
import { BetterTimeWindowsPanel } from './BetterTimeWindowsPanel.tsx';
import { CommuteStrategyPanel } from './CommuteStrategyPanel.tsx';
import {
  RoutineOverviewSection,
  type ImpactFilter,
  type PeriodFilter,
} from './RoutineOverviewSection.tsx';
import { RoutineRecommendationCard } from './RoutineRecommendationCard.tsx';

export interface DailyRoutinesWorkspaceProps {
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly airQualitySyncToken?: string | undefined;
  readonly onSessionIssue?: ((error: unknown) => void) | undefined;
}

export function DailyRoutinesWorkspace({
  profile,
  apiClient,
  airQualitySyncToken,
  onSessionIssue,
}: DailyRoutinesWorkspaceProps) {
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [scenarioCommute, setScenarioCommute] = useState<CommuteMode | undefined>(undefined);
  const [scenarioOutdoor, setScenarioOutdoor] = useState<OutdoorActivityPattern | undefined>(
    undefined,
  );

  const profileSyncKey = buildProfileSyncKey(profile);
  const enabled = profileSyncKey.length > 0 && airQualitySyncToken !== '__never__';
  const requestKey = `${profileSyncKey}|${airQualitySyncToken ?? ''}|${scenarioCommute ?? ''}|${scenarioOutdoor ?? ''}`;

  const fetcher = useCallback(
    () =>
      apiClient.getDailyRoutines({
        ...(scenarioCommute !== undefined ? { commuteMode: scenarioCommute } : {}),
        ...(scenarioOutdoor !== undefined ? { outdoorActivityPattern: scenarioOutdoor } : {}),
      }),
    [apiClient, scenarioCommute, scenarioOutdoor],
  );

  const refresher = useCallback(
    () =>
      apiClient.refreshDailyRoutines({
        forceRefresh: true,
        ...(scenarioCommute !== undefined ? { commuteMode: scenarioCommute } : {}),
        ...(scenarioOutdoor !== undefined ? { outdoorActivityPattern: scenarioOutdoor } : {}),
      }),
    [apiClient, scenarioCommute, scenarioOutdoor],
  );

  const {
    data: routineData,
    error: loadError,
    isLoading,
    isRefreshing,
    refresh,
  } = useWorkspaceResource({
    requestKey,
    enabled,
    moduleLabel: 'Low-Emission Daily Routines',
    fetcher,
    refresher,
    onSessionIssue,
  });

  const handleChangeScenario = useCallback(
    (next: {
      readonly commuteMode?: CommuteMode;
      readonly outdoorActivityPattern?: OutdoorActivityPattern;
    }) => {
      if (next.commuteMode !== undefined) {
        setScenarioCommute(
          next.commuteMode === profile.primaryCommuteMode ? undefined : next.commuteMode,
        );
      }
      if (next.outdoorActivityPattern !== undefined) {
        setScenarioOutdoor(
          next.outdoorActivityPattern === profile.outdoorActivityPattern
            ? undefined
            : next.outdoorActivityPattern,
        );
      }
    },
    [profile.outdoorActivityPattern, profile.primaryCommuteMode],
  );

  const handleResetScenario = useCallback(() => {
    setScenarioCommute(undefined);
    setScenarioOutdoor(undefined);
  }, []);

  if (isLoading && !routineData) {
    return (
      <WorkspaceLoadingCard
        headingId="routines-loading-heading"
        title="Generating Low-Emission Daily Routines..."
        description={`Evaluating your saved household profile and ${profile.city} forecast windows.`}
      />
    );
  }

  if (loadError && !routineData) {
    return (
      <WorkspaceErrorRetryBanner
        title="Daily routine generation failed"
        error={loadError}
        retryLabel="Retry daily routines"
        onRetry={() => void refresh()}
      />
    );
  }

  if (!routineData) {
    return null;
  }

  const visiblePeriods = routineData.periods
    .filter((group) => periodFilter === 'all' || group.period === periodFilter)
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => impactFilter === 'all' || item.impactType === impactFilter,
      ),
    }));

  const hasAnyFilteredItems = visiblePeriods.some((group) => group.items.length > 0);

  return (
    <div className="space-y-6" data-testid="daily-routines-workspace">
      {loadError ? (
        <AlertBanner tone="error" title="Routine refresh notice">
          <p>{loadError}</p>
        </AlertBanner>
      ) : null}

      <RoutineOverviewSection
        data={routineData}
        impactFilter={impactFilter}
        periodFilter={periodFilter}
        isRefreshing={isRefreshing}
        onSelectImpactFilter={setImpactFilter}
        onSelectPeriodFilter={setPeriodFilter}
        onChangeScenario={handleChangeScenario}
        onResetScenario={handleResetScenario}
        onRefresh={() => void refresh()}
      />

      <BetterTimeWindowsPanel betterTimeWindows={routineData.betterTimeWindows} />

      <CommuteStrategyPanel commuteSummary={routineData.commuteSummary} />

      {!hasAnyFilteredItems ? (
        <SurfaceCard as="section" aria-labelledby="routines-empty-filter-heading">
          <h3 id="routines-empty-filter-heading" className="text-lg font-bold text-slate-950">
            No routine actions match your current filter
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Reset the benefit or time-of-day filters to inspect all recommendations for your
            household.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setImpactFilter('all');
                setPeriodFilter('all');
              }}
            >
              Show all routine actions
            </Button>
          </div>
        </SurfaceCard>
      ) : (
        <div className="space-y-6">
          {visiblePeriods.map((group) => (
            <SurfaceCard
              key={group.period}
              as="section"
              aria-labelledby={`routine-period-${group.period}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-4">
                <div>
                  <p className="font-mono text-xs font-semibold tracking-wider text-slate-600 uppercase">
                    {group.windowHint}
                  </p>
                  <h3
                    id={`routine-period-${group.period}`}
                    className="mt-0.5 text-xl font-bold text-slate-950"
                  >
                    {group.label} Routine
                  </h3>
                </div>
                <p className="text-xs text-slate-700">{group.periodSummary}</p>
              </div>

              {group.items.length === 0 ? (
                <p className="mt-4 text-sm text-slate-700">
                  No recommendations match the selected impact filter during the{' '}
                  {group.label.toLowerCase()} window.
                </p>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {group.items.map((item) => (
                    <RoutineRecommendationCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}
