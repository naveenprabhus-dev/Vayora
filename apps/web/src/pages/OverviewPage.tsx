import type {
  AdvisoryExplanationFocus,
  AdvisorySourceModule,
  HouseholdLifestyleRecord,
} from '@uaqa/contracts';
import { MapPin } from 'lucide-react';
import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { Button, PageHeader, SurfaceCard } from '../components/index.ts';
import type { WorkspacePageId } from '../features/navigation/navConfig.ts';
import { OverviewAqiSummaryCard } from '../features/overview/OverviewAqiSummaryCard.tsx';
import { OverviewBriefingCard } from '../features/overview/OverviewBriefingCard.tsx';
import { OverviewNextRoutineCard } from '../features/overview/OverviewNextRoutineCard.tsx';
import { OverviewPriorityActionsCard } from '../features/overview/OverviewPriorityActionsCard.tsx';
import { OverviewQuickModulesCard } from '../features/overview/OverviewQuickModulesCard.tsx';
import { selectAlternativeOptions, useAdvisoryExplorer } from '../hooks/useAdvisoryExplorer.ts';
import { useWorkspaceResource } from '../hooks/useWorkspaceResource.ts';
import type { WebApiClient } from '../lib/apiClient.ts';
import type { AuthUserSnapshot } from '../lib/authService.ts';
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

export function OverviewPage({
  user,
  profile,
  apiClient,
  airQualitySyncToken,
  onNavigate,
  onSessionIssue,
}: OverviewPageProps) {
  const [selectedFocus, setSelectedFocus] = useState<AdvisoryExplanationFocus>('balanced');
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);

  const profileSyncKey = buildProfileSyncKey(profile);
  const queryEnabled = profileSyncKey.length > 0 && airQualitySyncToken !== '__never__';
  const aqRequestKey = `${profileSyncKey}|${airQualitySyncToken ?? ''}`;
  const briefingRequestKey = `${aqRequestKey}|${selectedFocus}`;

  const explorer = useAdvisoryExplorer({
    apiClient,
    selectedFocus,
    onSessionIssue,
  });

  const fetchAqSummary = useCallback(
    () => apiClient.getAirQualityCurrent({ hours: 24 }),
    [apiClient],
  );
  const fetchRoutine = useCallback(() => apiClient.getDailyRoutines(), [apiClient]);
  const fetchBriefing = useCallback(
    () => apiClient.getPersonalizedBriefing({ focus: selectedFocus }),
    [apiClient, selectedFocus],
  );
  const refreshBriefing = useCallback(
    () =>
      apiClient.refreshPersonalizedAdvisory({
        focus: selectedFocus,
        forceRefresh: true,
      }),
    [apiClient, selectedFocus],
  );

  const aqResource = useWorkspaceResource({
    requestKey: aqRequestKey,
    enabled: queryEnabled,
    moduleLabel: 'Air Quality Summary',
    fetcher: fetchAqSummary,
    onSessionIssue,
  });

  const routineResource = useWorkspaceResource({
    requestKey: aqRequestKey,
    enabled: queryEnabled,
    moduleLabel: 'Upcoming Daily Routine',
    fetcher: fetchRoutine,
    onSessionIssue,
  });

  const briefingResource = useWorkspaceResource({
    requestKey: briefingRequestKey,
    enabled: queryEnabled,
    moduleLabel: 'Personalized Daily Briefing',
    fetcher: fetchBriefing,
    refresher: refreshBriefing,
    onLoaded: explorer.syncDefaultSelections,
    onSessionIssue,
  });

  const { selectAndExplain } = explorer;
  const handleInspectAction = useCallback(
    (recommendationId: string, sourceModule: AdvisorySourceModule) => {
      setIsExplorerOpen(true);
      selectAndExplain(recommendationId, sourceModule);
    },
    [selectAndExplain],
  );

  const briefing = briefingResource.data;
  const alternativeOptions = useMemo(() => selectAlternativeOptions(briefing), [briefing]);
  const topActions = useMemo(() => (briefing?.priorityActions ?? []).slice(0, 3), [briefing]);

  return (
    <div className="space-y-6" data-testid="page-overview">
      <PageHeader
        kicker={`Welcome, ${user.displayName}`}
        title="Air Quality Overview"
        description={`${profile.neighborhood}, ${profile.city}, ${profile.country} · Postal prefix ${profile.postalPrefix}`}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => onNavigate('air-quality')}>
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Change location
            </Button>
            <Button type="button" variant="primary" onClick={() => onNavigate('household')}>
              My Household
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <OverviewAqiSummaryCard
          city={profile.city}
          aqData={aqResource.data}
          aqError={aqResource.error}
          isLoadingAq={aqResource.isLoading}
          onNavigate={onNavigate}
        />

        <OverviewBriefingCard
          city={profile.city}
          briefing={briefing}
          briefingError={briefingResource.error}
          isLoadingBriefing={briefingResource.isLoading}
          isRefreshingBriefing={briefingResource.isRefreshing}
          isExplorerOpen={isExplorerOpen}
          onRefreshBriefing={() => void briefingResource.refresh()}
          onToggleExplorer={() => setIsExplorerOpen((prev) => !prev)}
        />
      </div>

      <OverviewPriorityActionsCard
        neighborhood={profile.neighborhood}
        city={profile.city}
        isLoading={briefingResource.isLoading && !briefing}
        actions={topActions}
        onInspectAction={handleInspectAction}
        onNavigate={onNavigate}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OverviewNextRoutineCard
          routineData={routineResource.data}
          routineError={routineResource.error}
          isLoadingRoutine={routineResource.isLoading}
          onNavigate={onNavigate}
        />

        <OverviewQuickModulesCard onNavigate={onNavigate} />
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
          <div
            className="grid grid-cols-1 gap-6 xl:grid-cols-2"
            data-testid="overview-impact-explorer"
          >
            <RecommendationExplainerPanel
              recommendations={briefing.availableRecommendations}
              selectedRecommendationId={explorer.selectedRecId}
              selectedSourceModule={explorer.selectedSourceModule}
              selectedFocus={selectedFocus}
              explanation={explorer.explanation}
              isExplaining={explorer.isExplaining}
              explainError={explorer.explainError}
              onSelectRecommendation={explorer.selectRecommendation}
              onSelectFocus={setSelectedFocus}
              onRequestExplanation={() =>
                void explorer.requestExplanationFor(
                  explorer.selectedRecId,
                  explorer.selectedSourceModule,
                  selectedFocus,
                )
              }
            />

            <ChoiceComparisonExplainerPanel
              alternativeOptions={alternativeOptions}
              selectedAlternativeId={explorer.selectedAlternativeId}
              comparisonExplanation={explorer.comparisonExplanation}
              isComparing={explorer.isComparing}
              compareError={explorer.compareError}
              onSelectAlternativeId={explorer.setSelectedAlternativeId}
              onRequestComparison={() => void explorer.handleCompareChoices()}
            />
          </div>
        </Suspense>
      ) : null}
    </div>
  );
}
