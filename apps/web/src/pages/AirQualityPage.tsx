import type { HouseholdLifestyleRecord } from '@uaqa/contracts';
import { PageHeader } from '../components/index.ts';
import { AirQualityDashboard } from '../features/air-quality/AirQualityDashboard.tsx';
import type { WebApiClient } from '../lib/apiClient.ts';
import type { HouseholdStore } from '../lib/householdStore.ts';

export interface AirQualityPageProps {
  readonly userId: string;
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly householdStore: HouseholdStore;
  readonly onProfileUpdated: (updated: HouseholdLifestyleRecord) => void;
  readonly onTelemetryUpdated?: (syncToken: string) => void;
  readonly onSessionIssue?: (error: unknown) => void;
}

export function AirQualityPage({
  userId,
  profile,
  apiClient,
  householdStore,
  onProfileUpdated,
  onTelemetryUpdated,
  onSessionIssue,
}: AirQualityPageProps) {
  return (
    <div className="space-y-6" data-testid="page-air-quality">
      <PageHeader
        kicker="Air Quality Intelligence"
        title="Live Air Quality & Forecast"
        description={`Independent US EPA and European EEA scales, 6 pollutants, hourly forecast, and source attribution for ${profile.neighborhood}, ${profile.city}, ${profile.country}.`}
      />

      <AirQualityDashboard
        userId={userId}
        profile={profile}
        apiClient={apiClient}
        householdStore={householdStore}
        onProfileUpdated={onProfileUpdated}
        onTelemetryUpdated={onTelemetryUpdated}
        onSessionIssue={onSessionIssue}
      />
    </div>
  );
}
