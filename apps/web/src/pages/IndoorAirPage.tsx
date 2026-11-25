import type { HouseholdLifestyleRecord } from '@uaqa/contracts';
import { PageHeader } from '../components/index.ts';
import { IndoorAirAssistantWorkspace } from '../features/indoor/IndoorAirAssistantWorkspace.tsx';
import type { WebApiClient } from '../lib/apiClient.ts';

export interface IndoorAirPageProps {
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly airQualitySyncToken?: string | undefined;
  readonly onSessionIssue?: (error: unknown) => void;
}

export function IndoorAirPage({
  profile,
  apiClient,
  airQualitySyncToken,
  onSessionIssue,
}: IndoorAirPageProps) {
  return (
    <div className="space-y-6" data-testid="page-indoor-air">
      <PageHeader
        kicker="Indoor Air"
        title="Indoor Air Quality Assistant"
        description={`Ventilation timing, HEPA particle-only limits, household scenarios, and indoor source guides for ${profile.city}.`}
      />

      <IndoorAirAssistantWorkspace
        profile={profile}
        apiClient={apiClient}
        airQualitySyncToken={airQualitySyncToken}
        onSessionIssue={onSessionIssue}
      />
    </div>
  );
}
