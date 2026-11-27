import type {
  HouseholdLifestyleRecord,
  IndoorAirGuidanceResponse,
  IndoorScenarioId,
} from '@uaqa/contracts';
import { useCallback, useEffect, useState } from 'react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import { formatWorkspaceError } from '../../lib/errorMessages.ts';
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
  const [guidanceData, setGuidanceData] = useState<IndoorAirGuidanceResponse | null>(null);
  const [scenario, setScenario] = useState<IndoorScenarioId>('baseline');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const profileSyncKey = buildProfileSyncKey(profile);
  const hasRequiredIndoorSetup = Boolean(profile.ventilationContext && profile.heatingType);

  useEffect(() => {
    let cancelled = false;
    async function loadIndoorGuidance() {
      setLoadError(null);
      try {
        // Trigger dependency awareness cleanly when profile/location/outdoor telemetry updates
        const query = scenario === 'baseline' ? {} : { scenario };
        const response = await apiClient.getIndoorAirGuidance(query);
        if (!cancelled) {
          setGuidanceData(response);
        }
      } catch (error) {
        if (!cancelled) {
          onSessionIssue?.(error);
          setLoadError(formatWorkspaceError(error, 'Indoor Air Quality Assistant'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    if (
      profileSyncKey.length > 0 &&
      hasRequiredIndoorSetup &&
      airQualitySyncToken !== '__never__'
    ) {
      void loadIndoorGuidance();
    }

    return () => {
      cancelled = true;
    };
  }, [
    apiClient,
    scenario,
    airQualitySyncToken,
    profileSyncKey,
    hasRequiredIndoorSetup,
    onSessionIssue,
  ]);

  const handleSelectScenario = useCallback((nextScenario: IndoorScenarioId) => {
    setIsRefreshing(true);
    setScenario(nextScenario);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const response = await apiClient.refreshIndoorAirGuidance({
        forceRefresh: true,
        ...(scenario !== 'baseline' ? { scenario } : {}),
      });
      setGuidanceData(response);
    } catch (error) {
      onSessionIssue?.(error);
      setLoadError(formatWorkspaceError(error, 'Indoor Air Quality Assistant'));
    } finally {
      setIsRefreshing(false);
    }
  }, [apiClient, onSessionIssue, scenario]);

  if (isLoading && !guidanceData) {
    return (
      <SurfaceCard as="section" aria-labelledby="indoor-loading-heading">
        <output aria-live="polite" className="block space-y-2 text-sm text-slate-700">
          <p id="indoor-loading-heading" className="font-semibold text-slate-950">
            Preparing Indoor Air Quality Assistant...
          </p>
          <p>
            Evaluating your saved ventilation context, purifier availability, and {profile.city}{' '}
            outdoor air conditions.
          </p>
        </output>
      </SurfaceCard>
    );
  }

  if (loadError && !guidanceData) {
    return (
      <AlertBanner tone="error" title="Indoor Air Quality Assistant failed to load">
        <p>{loadError}</p>
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={() => void handleRefresh()}>
            Retry indoor guidance
          </Button>
        </div>
      </AlertBanner>
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
        onSelectScenario={handleSelectScenario}
        onRefresh={() => void handleRefresh()}
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
