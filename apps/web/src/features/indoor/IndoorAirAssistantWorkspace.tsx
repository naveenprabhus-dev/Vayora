import type {
  HouseholdLifestyleRecord,
  IndoorAirGuidanceResponse,
  IndoorScenarioId,
} from '@uaqa/contracts';
import { useCallback, useEffect, useState } from 'react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import { IndoorActionPlanSection } from './IndoorActionPlanSection.tsx';
import { IndoorEnvironmentSection } from './IndoorEnvironmentSection.tsx';
import { PollutionSourcesSection } from './PollutionSourcesSection.tsx';
import { VentilationAndPurifierSection } from './VentilationAndPurifierSection.tsx';

export interface IndoorAirAssistantWorkspaceProps {
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly airQualitySyncToken?: string | undefined;
}

export function IndoorAirAssistantWorkspace({
  profile,
  apiClient,
  airQualitySyncToken,
}: IndoorAirAssistantWorkspaceProps) {
  const [guidanceData, setGuidanceData] = useState<IndoorAirGuidanceResponse | null>(null);
  const [scenario, setScenario] = useState<IndoorScenarioId>('baseline');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to load indoor air quality guidance right now.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    if (
      profile.country &&
      profile.city &&
      profile.ventilationContext &&
      profile.heatingType &&
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
    profile.country,
    profile.city,
    profile.neighborhood,
    profile.postalPrefix,
    profile.ventilationContext,
    profile.hasIndoorAirPurifier,
    profile.heatingType,
    profile.householdSize,
    profile.householdComposition,
    profile.lifestylePreferences.preferredGuidanceFocus,
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
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to refresh indoor air quality guidance right now.',
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [apiClient, scenario]);

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
