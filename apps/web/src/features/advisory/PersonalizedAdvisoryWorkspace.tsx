import type { AdvisoryExplanationFocus, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { useCallback, useMemo, useState } from 'react';
import {
  AlertBanner,
  WorkspaceErrorRetryBanner,
  WorkspaceLoadingCard,
} from '../../components/index.ts';
import { selectAlternativeOptions, useAdvisoryExplorer } from '../../hooks/useAdvisoryExplorer.ts';
import { useWorkspaceResource } from '../../hooks/useWorkspaceResource.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import { buildProfileSyncKey } from '../../lib/profileSync.ts';
import { ChoiceComparisonExplainerPanel } from './ChoiceComparisonExplainerPanel.tsx';
import { DailyBriefingPanel } from './DailyBriefingPanel.tsx';
import { RecommendationExplainerPanel } from './RecommendationExplainerPanel.tsx';

export interface PersonalizedAdvisoryWorkspaceProps {
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly airQualitySyncToken?: string | undefined;
  readonly onSessionIssue?: (error: unknown) => void;
}

export function PersonalizedAdvisoryWorkspace({
  profile,
  apiClient,
  airQualitySyncToken,
  onSessionIssue,
}: PersonalizedAdvisoryWorkspaceProps) {
  const [selectedFocus, setSelectedFocus] = useState<AdvisoryExplanationFocus>('balanced');
  const profileSyncKey = buildProfileSyncKey(profile);
  const enabled = profileSyncKey.length > 0 && airQualitySyncToken !== '__never__';
  const requestKey = `${profileSyncKey}|${airQualitySyncToken ?? ''}|${selectedFocus}`;

  const explorer = useAdvisoryExplorer({
    apiClient,
    selectedFocus,
    onSessionIssue,
  });

  const fetcher = useCallback(
    () => apiClient.getPersonalizedBriefing({ focus: selectedFocus }),
    [apiClient, selectedFocus],
  );

  const refresher = useCallback(
    () =>
      apiClient.refreshPersonalizedAdvisory({
        focus: selectedFocus,
        forceRefresh: true,
      }),
    [apiClient, selectedFocus],
  );

  const {
    data: briefing,
    error: loadError,
    isLoading,
    isRefreshing,
    refresh,
  } = useWorkspaceResource({
    requestKey,
    enabled,
    moduleLabel: 'Personalized Daily Briefing',
    fetcher,
    refresher,
    onLoaded: explorer.syncDefaultSelections,
    onSessionIssue,
  });

  const alternativeOptions = useMemo(() => selectAlternativeOptions(briefing), [briefing]);

  if (isLoading && !briefing) {
    return (
      <WorkspaceLoadingCard
        headingId="advisory-loading-heading"
        title="Preparing Personalized Daily Briefing..."
        description={`Synthesizing grounded explanations across your routines, indoor setup, and sustainable alternatives for ${profile.city}.`}
      />
    );
  }

  if (loadError && !briefing) {
    return (
      <WorkspaceErrorRetryBanner
        title="Personalized Briefing unavailable"
        error={loadError}
        retryLabel="Retry briefing"
        onRetry={() => void refresh()}
      />
    );
  }

  if (!briefing) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="personalized-advisory-workspace">
      {loadError ? (
        <AlertBanner tone="error" title="Personalized advisory notice">
          <p>{loadError}</p>
        </AlertBanner>
      ) : null}

      <DailyBriefingPanel
        briefing={briefing}
        isRefreshing={isRefreshing}
        selectedRecommendationId={explorer.explanation?.recommendation.recommendationId ?? null}
        onRefresh={() => void refresh()}
        onInspectRecommendation={explorer.selectAndExplain}
      />

      <div className="grid gap-6 xl:grid-cols-2">
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
    </div>
  );
}
