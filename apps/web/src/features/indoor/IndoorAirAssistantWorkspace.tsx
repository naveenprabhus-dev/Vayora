import type { HouseholdLifestyleRecord, IndoorScenarioId } from '@uaqa/contracts';
import { useCallback, useState } from 'react';
import {
  AlertBanner,
  WorkspaceErrorRetryBanner,
  WorkspaceLoadingCard,
} from '../../components/index.ts';
import { useWorkspaceResource } from '../../hooks/useWorkspaceResource.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import { buildProfileSyncKey } from '../../lib/profileSync.ts';
import { IndoorActionPlanSection } from './IndoorActionPlanSection.tsx';
import { IndoorEnvironmentSection } from './IndoorEnvironmentSection.tsx';
import { PollutionSourcesSection } from './PollutionSourcesSection.tsx';
import { VentilationAndPurifierSection } from './VentilationAndPurifierSection.tsx';

export interface IndoorAirAssistantWorkspaceProps {
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly airQualitySyncToken?: string | undefined;
  readonly onSessionIssue?: ((error: unknown) => void) | undefined;
}

export function IndoorAirAssistantWorkspace({
  profile,
  apiClient,
  airQualitySyncToken,
  onSessionIssue,
}: IndoorAirAssistantWorkspaceProps) {
  const [scenario, setScenario] = useState<IndoorScenarioId>('baseline');

  const profileSyncKey = buildProfileSyncKey(profile);
  const hasRequiredIndoorSetup = Boolean(profile.ventilationContext && profile.heatingType);
  const enabled =
    profileSyncKey.length > 0 && hasRequiredIndoorSetup && airQualitySyncToken !== '__never__';
  const requestKey = `${profileSyncKey}|${airQualitySyncToken ?? ''}|${scenario}`;

  const fetcher = useCallback(
    () => apiClient.getIndoorAirGuidance(scenario === 'baseline' ? {} : { scenario }),
    [apiClient, scenario],
  );

  const refresher = useCallback(
    () =>
      apiClient.refreshIndoorAirGuidance({
        forceRefresh: true,
        ...(scenario !== 'baseline' ? { scenario } : {}),
      }),
    [apiClient, scenario],
  );

  const {
    data: guidanceData,
    error: loadError,
    isLoading,
    isRefreshing,
    refresh,
  } = useWorkspaceResource({
    requestKey,
    enabled,
    moduleLabel: 'Indoor Air Quality Assistant',
    fetcher,
    refresher,
    onSessionIssue,
  });

  if (isLoading && !guidanceData) {
    return (
      <WorkspaceLoadingCard
        headingId="indoor-loading-heading"
        title="Preparing Indoor Air Quality Assistant..."
        description={`Evaluating your saved ventilation context, purifier availability, and ${profile.city} outdoor air conditions.`}
      />
    );
  }

  if (loadError && !guidanceData) {
    return (
      <WorkspaceErrorRetryBanner
        title="Indoor Air Quality Assistant failed to load"
        error={loadError}
        retryLabel="Retry indoor guidance"
        onRetry={() => void refresh()}
      />
    );
  }

  if (!guidanceData) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="indoor-air-assistant-workspace">
      {loadError ? (
        <AlertBanner tone="error" title="Indoor guidance refresh notice">
          <p>{loadError}</p>
        </AlertBanner>
      ) : null}

      <IndoorEnvironmentSection
        data={guidanceData}
        isRefreshing={isRefreshing}
        onSelectScenario={setScenario}
        onRefresh={() => void refresh()}
      />

      <VentilationAndPurifierSection
        ventilationGuidance={guidanceData.ventilationGuidance}
        purifierGuidance={guidanceData.purifierGuidance}
      />

      <IndoorActionPlanSection actionPlan={guidanceData.actionPlan} />

      <PollutionSourcesSection pollutionSources={guidanceData.pollutionSources} />
    </div>
  );
}
