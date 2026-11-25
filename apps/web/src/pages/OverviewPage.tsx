import type {
  AdvisoryExplanationFocus,
  AdvisorySourceModule,
  AirQualityCurrentResponse,
  ChoiceComparisonExplanationResponse,
  DailyRoutineResponse,
  HouseholdLifestyleRecord,
  PersonalizedBriefingResponse,
  RoutineRecommendationItem,
  WhyRecommendationResponse,
} from '@uaqa/contracts';
import { ArrowRight, CalendarClock, MapPin, RefreshCw, Sparkles } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { buildWorkspaceUrl } from '../app/routing.ts';
import { AlertBanner, Button, PageHeader, SurfaceCard } from '../components/index.ts';
import {
  getAdvisoryImpactVisual,
  getGenerationModeVisual,
  getSourceModuleLabel,
} from '../features/advisory/advisoryStyles.ts';
import { formatIsoTimestamp, getAqiSeverityVisual } from '../features/air-quality/severityStyles.ts';
import { WORKSPACE_NAV_ITEMS, type WorkspacePageId } from '../features/navigation/navConfig.ts';
import { getRoutineStatusVisual } from '../features/routines/routineStyles.ts';
import type { WebApiClient } from '../lib/apiClient.ts';
import type { AuthUserSnapshot } from '../lib/authService.ts';
import { formatWorkspaceError } from '../lib/errorMessages.ts';
import { buildProfileSyncKey } from '../lib/profileSync.ts';

const RecommendationExplainerPanel = lazy(() =>
  import('../features/advisory/RecommendationExplainerPanel.tsx').then((mod) => ({
    default: mod.RecommendationExplainerPanel,
  })),
);

const ChoiceComparisonExplainerPanel = lazy(() =>
  import('../features/advisory/ChoiceComparisonExplainerPanel.tsx').then((mod) => ({
    default: mod.ChoiceComparisonExplainerPanel,
  })),
);

export interface OverviewPageProps {
  readonly user: AuthUserSnapshot;
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly airQualitySyncToken?: string | undefined;
  readonly onNavigate: (pageId: WorkspacePageId) => void;
  readonly onSessionIssue?: (error: unknown) => void;
}

function mapSourceModuleToPage(sourceModule: AdvisorySourceModule): WorkspacePageId {
  switch (sourceModule) {
    case 'routines':
      return 'daily-routines';
    case 'indoor':
      return 'indoor-air';
    case 'alternatives':
      return 'sustainable-alternatives';
  }
}

function selectNextUpcomingRoutine(routineData: DailyRoutineResponse | null): {
  readonly periodLabel: string;
  readonly windowHint: string;
  readonly item: RoutineRecommendationItem;
} | null {
  if (!routineData || routineData.periods.length === 0) {
    return null;
  }

  for (const group of routineData.periods) {
    const recommended = group.items.find((item) => item.status === 'recommended');
    if (recommended) {
      return {
        periodLabel: group.label,
        windowHint: group.windowHint,
        item: recommended,
      };
    }
  }

  for (const group of routineData.periods) {
    const firstItem = group.items[0];
    if (firstItem) {
      return {
        periodLabel: group.label,
        windowHint: group.windowHint,
        item: firstItem,
      };
    }
  }

  return null;
}

export function OverviewPage({
  user,
  profile,
  apiClient,
  airQualitySyncToken,
  onNavigate,
  onSessionIssue,
}: OverviewPageProps) {
  const [aqData, setAqData] = useState<AirQualityCurrentResponse | null>(null);
  const [aqError, setAqError] = useState<string | null>(null);
  const [isLoadingAq, setIsLoadingAq] = useState(true);

  const [briefing, setBriefing] = useState<PersonalizedBriefingResponse | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(true);
  const [isRefreshingBriefing, setIsRefreshingBriefing] = useState(false);

  const [routineData, setRoutineData] = useState<DailyRoutineResponse | null>(null);
  const [routineError, setRoutineError] = useState<string | null>(null);
  const [isLoadingRoutine, setIsLoadingRoutine] = useState(true);

  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [selectedRecId, setSelectedRecId] = useState('');
  const [selectedSourceModule, setSelectedSourceModule] =
    useState<AdvisorySourceModule>('routines');
  const [selectedFocus, setSelectedFocus] = useState<AdvisoryExplanationFocus>('balanced');
  const [explanation, setExplanation] = useState<WhyRecommendationResponse | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const [selectedAlternativeId, setSelectedAlternativeId] = useState('');
  const [comparisonExplanation, setComparisonExplanation] =
    useState<ChoiceComparisonExplanationResponse | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const profileSyncKey = buildProfileSyncKey(profile);

  const syncDefaultSelections = useCallback((nextBriefing: PersonalizedBriefingResponse) => {
    const firstPriority =
      nextBriefing.priorityActions[0] ?? nextBriefing.availableRecommendations[0];
    if (firstPriority) {
      setSelectedRecId(firstPriority.recommendationId);
      setSelectedSourceModule(firstPriority.sourceModule);
    }
    const firstAlt = nextBriefing.availableRecommendations.find(
      (entry) => entry.sourceModule === 'alternatives',
    );
    if (firstAlt) {
      setSelectedAlternativeId(firstAlt.recommendationId);
    }
    setExplanation(null);
    setComparisonExplanation(null);
    setExplainError(null);
    setCompareError(null);
  }, []);

  useEffect(() => {
    if (profileSyncKey.length === 0 || airQualitySyncToken === '__never__') {
      return;
    }

    let cancelled = false;

    setIsLoadingAq(true);
    setAqError(null);
    void apiClient
      .getAirQualityCurrent({ hours: 24 })
      .then((res) => {
        if (!cancelled) {
          setAqData(res);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          onSessionIssue?.(error);
          setAqError(formatWorkspaceError(error, 'Air Quality Summary'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingAq(false);
        }
      });

    setIsLoadingRoutine(true);
    setRoutineError(null);
    void apiClient
      .getDailyRoutines()
      .then((res) => {
        if (!cancelled) {
          setRoutineData(res);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          onSessionIssue?.(error);
          setRoutineError(formatWorkspaceError(error, 'Upcoming Daily Routine'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRoutine(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, airQualitySyncToken, onSessionIssue, profileSyncKey]);

  useEffect(() => {
    if (profileSyncKey.length === 0 || airQualitySyncToken === '__never__') {
      return;
    }

    let cancelled = false;

    setIsLoadingBriefing(true);
    setBriefingError(null);
    void apiClient
      .getPersonalizedBriefing({ focus: selectedFocus })
      .then((res) => {
        if (!cancelled) {
          setBriefing(res);
          syncDefaultSelections(res);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          onSessionIssue?.(error);
          setBriefingError(formatWorkspaceError(error, 'Personalized Daily Briefing'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingBriefing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    apiClient,
    airQualitySyncToken,
    onSessionIssue,
    profileSyncKey,
    selectedFocus,
    syncDefaultSelections,
  ]);

  const handleRefreshBriefing = useCallback(async () => {
    setIsRefreshingBriefing(true);
    setBriefingError(null);
    try {
      const response = await apiClient.refreshPersonalizedAdvisory({
        focus: selectedFocus,
        forceRefresh: true,
      });
      setBriefing(response);
      syncDefaultSelections(response);
    } catch (error) {
      onSessionIssue?.(error);
      setBriefingError(formatWorkspaceError(error, 'Personalized Daily Briefing'));
    } finally {
      setIsRefreshingBriefing(false);
    }
  }, [apiClient, onSessionIssue, selectedFocus, syncDefaultSelections]);

  const requestExplanationFor = useCallback(
    async (
      recommendationId: string,
      sourceModule: AdvisorySourceModule,
      focus: AdvisoryExplanationFocus,
    ) => {
      if (!recommendationId) {
        return;
      }
      setIsExplaining(true);
      setExplainError(null);
      try {
        const result = await apiClient.explainRecommendation({
          recommendationId,
          sourceModule,
          focus,
        });
        setExplanation(result);
      } catch (error) {
        onSessionIssue?.(error);
        setExplainError(formatWorkspaceError(error, 'Recommendation Explanation'));
      } finally {
        setIsExplaining(false);
      }
    },
    [apiClient, onSessionIssue],
  );

  const handleInspectAction = useCallback(
    (recommendationId: string, sourceModule: AdvisorySourceModule) => {
      setIsExplorerOpen(true);
      setSelectedRecId(recommendationId);
      setSelectedSourceModule(sourceModule);
      void requestExplanationFor(recommendationId, sourceModule, selectedFocus);
    },
    [requestExplanationFor, selectedFocus],
  );

  const handleCompareChoices = useCallback(async () => {
    if (!selectedAlternativeId) {
      return;
    }
    setIsComparing(true);
    setCompareError(null);
    try {
      const result = await apiClient.compareChoicesExplanation({
        alternativeId: selectedAlternativeId,
        focus: selectedFocus,
      });
      setComparisonExplanation(result);
    } catch (error) {
      onSessionIssue?.(error);
      setCompareError(formatWorkspaceError(error, 'Choice Comparison Explainer'));
    } finally {
      setIsComparing(false);
    }
  }, [apiClient, onSessionIssue, selectedAlternativeId, selectedFocus]);

  const alternativeOptions = useMemo(
    () =>
      (briefing?.availableRecommendations ?? []).filter(
        (entry) => entry.sourceModule === 'alternatives',
      ),
    [briefing],
  );

  const topActions = useMemo(() => (briefing?.priorityActions ?? []).slice(0, 3), [briefing]);
  const nextRoutine = useMemo(() => selectNextUpcomingRoutine(routineData), [routineData]);
  const bestWindow = routineData?.betterTimeWindows.windows[0] ?? null;
  const quickModuleLinks = useMemo(
    () => WORKSPACE_NAV_ITEMS.filter((item) => item.id !== 'overview' && item.id !== 'settings'),
    [],
  );

  function handleLinkNavigate(event: MouseEvent<HTMLAnchorElement>, pageId: WorkspacePageId) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onNavigate(pageId);
  }

  const usAqi = aqData?.aqi.usAqi;
  const euAqi = aqData?.aqi.europeanAqi;
  const usVisual = getAqiSeverityVisual(usAqi?.severityToken ?? 'unavailable');
  const UsIcon = usVisual.Icon;
  const modeVisual = briefing ? getGenerationModeVisual(briefing.generationMeta.generationMode) : null;
  const ModeIcon = modeVisual?.Icon;

  return (
    <div className="space-y-6" data-testid="page-overview">
      <PageHeader
        kicker={`Welcome, ${user.displayName}`}
        title="Air Quality Overview"
        description={`${profile.neighborhood}, ${profile.city}, ${profile.country} · Postal prefix ${profile.postalPrefix}`}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onNavigate('air-quality')}
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Change location
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => onNavigate('household')}
            >
              My Household
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
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
                    : `Resolving conditions for ${profile.city}`}
                </p>
              </div>
            </div>

            {isLoadingAq && !aqData ? (
              <output aria-live="polite" className="block py-4 text-sm text-slate-700">
                Loading current air quality index for {profile.city}...
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
                      <p className="font-mono text-xs font-semibold text-slate-700">
                        US AQI (EPA)
                      </p>
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
                        EEA AQI: {euAqi.value !== null ? `${euAqi.value} (${euAqi.category})` : 'Unavailable'}
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
              onClick={(e) => handleLinkNavigate(e, 'air-quality')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F5132] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
            >
              <span>Inspect pollutants &amp; 48h forecast</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          </div>
        </SurfaceCard>

        <SurfaceCard
          as="section"
          aria-labelledby="overview-briefing-heading"
          className="flex flex-col justify-between lg:col-span-7"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 id="overview-briefing-heading" className="text-lg font-bold text-slate-950">
                  Short Air-Quality Briefing
                </h2>
                {modeVisual && ModeIcon && briefing ? (
                  <p
                    className={`mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold ${modeVisual.textClass}`}
                  >
                    <ModeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span data-testid="advisory-origin-disclosure">{modeVisual.label}</span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="font-mono text-slate-600">
                      {briefing.generationMeta.cachedResult ? 'Cached summary' : 'Fresh synthesis'}
                    </span>
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                variant="secondary"
                disabled={isRefreshingBriefing || isLoadingBriefing}
                onClick={() => void handleRefreshBriefing()}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshingBriefing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{isRefreshingBriefing ? 'Refreshing...' : 'Refresh briefing'}</span>
              </Button>
            </div>

            {isLoadingBriefing && !briefing ? (
              <output aria-live="polite" className="block py-4 text-sm text-slate-700">
                Preparing concise daily briefing for {profile.city}...
              </output>
            ) : briefingError && !briefing ? (
              <AlertBanner tone="error" title="Air-quality briefing unavailable">
                <p>{briefingError}</p>
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleRefreshBriefing()}
                  >
                    Retry briefing
                  </Button>
                </div>
              </AlertBanner>
            ) : briefing ? (
              <div className="space-y-3">
                {briefing.generationMeta.generationMode === 'deterministic_fallback' ? (
                  <AlertBanner tone="warning" title="Deterministic fallback explanation active">
                    <p>
                      {briefing.generationMeta.aiDisclosure}
                      {briefing.generationMeta.fallbackReason
                        ? ` Reason: ${briefing.generationMeta.fallbackReason}`
                        : ''}
                    </p>
                  </AlertBanner>
                ) : null}

                {briefing.generationMeta.freshnessDisclosure !== 'fresh' ? (
                  <AlertBanner
                    tone="warning"
                    title={
                      briefing.generationMeta.freshnessDisclosure === 'unavailable'
                        ? 'Outdoor air quality data unavailable'
                        : 'Stale cached outdoor air quality data active'
                    }
                  >
                    <p>{briefing.generationMeta.freshnessMessage}</p>
                  </AlertBanner>
                ) : null}

                <h3 className="text-base font-bold text-slate-950">{briefing.headline}</h3>
                <p className="text-sm leading-relaxed text-slate-700">{briefing.summary}</p>
                <p className="text-xs leading-relaxed text-slate-600">
                  <strong className="text-slate-800">Outdoor influence: </strong>
                  {briefing.outdoorInfluenceSummary}
                </p>
                <p className="text-xs leading-relaxed text-slate-600">
                  {briefing.cautionsAndLimitations}
                </p>
              </div>
            ) : null}
          </div>

          {briefing ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <Button
                type="button"
                variant="secondary"
                aria-expanded={isExplorerOpen}
                onClick={() => setIsExplorerOpen((prev) => !prev)}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {isExplorerOpen
                  ? 'Hide impact & choice explorer'
                  : 'Open impact & choice explorer'}
              </Button>
              <span className="text-xs text-slate-600">
                {briefing.generationMeta.nonMedicalNotice}
              </span>
            </div>
          ) : null}
        </SurfaceCard>
      </div>

      <SurfaceCard as="section" aria-labelledby="overview-actions-heading">
        <div className="border-b border-slate-200 pb-4">
          <h2 id="overview-actions-heading" className="text-lg font-bold text-slate-950">
            Three Most Relevant Recommended Actions
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Highest-priority household steps for {profile.neighborhood}, {profile.city} based on
            current conditions.
          </p>
        </div>

        {isLoadingBriefing && !briefing ? (
          <output aria-live="polite" className="mt-4 block text-sm text-slate-700">
            Selecting top household actions...
          </output>
        ) : topActions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">No prioritized actions generated yet</p>
            <p className="mt-1 text-xs text-slate-600">
              Explore Daily Routines, Indoor Air, or Sustainable Alternatives directly for full
              module guidance.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {topActions.map((action) => {
              const impactVisual = getAdvisoryImpactVisual(action.impactCategory);
              const ImpactIcon = impactVisual.Icon;
              const targetPage = mapSourceModuleToPage(action.sourceModule);

              return (
                <article
                  key={`${action.sourceModule}:${action.recommendationId}`}
                  data-testid={`overview-action-${action.recommendationId}`}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">
                        {getSourceModuleLabel(action.sourceModule)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${impactVisual.textClass}`}
                      >
                        <ImpactIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{impactVisual.label}</span>
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-950">{action.title}</h3>
                    <p className="text-xs leading-relaxed text-slate-700">{action.rationale}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleInspectAction(action.recommendationId, action.sourceModule)
                      }
                      className="text-xs font-semibold text-[#0F5132] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
                    >
                      Why this recommendation?
                    </button>
                    <a
                      href={buildWorkspaceUrl(targetPage)}
                      onClick={(e) => handleLinkNavigate(e, targetPage)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 hover:text-[#0F5132] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
                    >
                      <span>Open module</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard
          as="section"
          aria-labelledby="overview-routine-heading"
          className="flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4 text-[#0F5132]">
              <CalendarClock className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 id="overview-routine-heading" className="text-lg font-bold text-slate-950">
                  Next Upcoming Daily Routine
                </h2>
              </div>
            </div>

            {isLoadingRoutine && !routineData ? (
              <output aria-live="polite" className="block py-3 text-sm text-slate-700">
                Loading upcoming routine schedule...
              </output>
            ) : routineError && !routineData ? (
              <AlertBanner tone="error" title="Upcoming routine unavailable">
                <p>{routineError}</p>
              </AlertBanner>
            ) : nextRoutine ? (
              <div className="space-y-3" data-testid="overview-next-routine">
                {(() => {
                  const statusVisual = getRoutineStatusVisual(nextRoutine.item.status);
                  const StatusIcon = statusVisual.Icon;
                  return (
                    <div className={`rounded-xl border p-4 ${statusVisual.surfaceClass}`}>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className={`inline-flex items-center gap-1 ${statusVisual.textClass}`}>
                          <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{statusVisual.label}</span>
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className="text-slate-800">{nextRoutine.periodLabel}</span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className="font-mono text-slate-700">
                          {nextRoutine.item.suggestedWindow}
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-bold text-slate-950">
                        {nextRoutine.item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-800">
                        {nextRoutine.item.explanation.whatToDo}
                      </p>
                    </div>
                  );
                })()}

                {bestWindow ? (
                  <p className="text-xs leading-relaxed text-slate-700">
                    <strong className="text-slate-900">Lower-AQI forecast window: </strong>
                    {bestWindow.label} ({bestWindow.rationale})
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  {routineData?.overview.headline ?? 'Routine schedule summary ready'}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {routineData?.overview.summary ??
                    'Open Daily Routines to inspect commute strategy and time windows.'}
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <a
              href={buildWorkspaceUrl('daily-routines')}
              onClick={(e) => handleLinkNavigate(e, 'daily-routines')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F5132] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
            >
              <span>View full Daily Routines</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          </div>
        </SurfaceCard>

        <SurfaceCard as="section" aria-labelledby="overview-modules-heading">
          <div className="border-b border-slate-200 pb-4">
            <h2 id="overview-modules-heading" className="text-lg font-bold text-slate-950">
              Quick Navigation to Modules
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Jump directly to dedicated tools and your saved household profile.
            </p>
          </div>

          <ul className="mt-4 divide-y divide-slate-200">
            {quickModuleLinks.map((item) => {
              const Icon = item.Icon;
              return (
                <li key={item.id}>
                  <a
                    href={buildWorkspaceUrl(item.id)}
                    onClick={(e) => handleLinkNavigate(e, item.id)}
                    className="group flex min-h-11 items-center justify-between gap-3 py-3 text-sm transition-colors hover:text-[#0F5132] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon
                        className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-[#0F5132]"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950 group-hover:text-[#0F5132]">
                          {item.label}
                        </p>
                        <p className="truncate text-xs text-slate-600">{item.shortDescription}</p>
                      </div>
                    </div>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#0F5132]"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </SurfaceCard>
      </div>

      {isExplorerOpen && briefing ? (
        <Suspense
          fallback={
            <SurfaceCard as="section">
              <output aria-live="polite" className="block text-sm text-slate-700">
                Loading 6-part impact &amp; choice explorer...
              </output>
            </SurfaceCard>
          }
        >
          <div className="grid gap-6 xl:grid-cols-2" data-testid="overview-impact-explorer">
            <RecommendationExplainerPanel
              recommendations={briefing.availableRecommendations}
              selectedRecommendationId={selectedRecId}
              selectedSourceModule={selectedSourceModule}
              selectedFocus={selectedFocus}
              explanation={explanation}
              isExplaining={isExplaining}
              explainError={explainError}
              onSelectRecommendation={(id, mod) => {
                setSelectedRecId(id);
                setSelectedSourceModule(mod);
              }}
              onSelectFocus={setSelectedFocus}
              onRequestExplanation={() =>
                void requestExplanationFor(selectedRecId, selectedSourceModule, selectedFocus)
              }
            />

            <ChoiceComparisonExplainerPanel
              alternativeOptions={alternativeOptions}
              selectedAlternativeId={selectedAlternativeId}
              comparisonExplanation={comparisonExplanation}
              isComparing={isComparing}
              compareError={compareError}
              onSelectAlternativeId={setSelectedAlternativeId}
              onRequestComparison={() => void handleCompareChoices()}
            />
          </div>
        </Suspense>
      ) : null}
    </div>
  );
}
