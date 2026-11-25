import type { HouseholdLifestyleRecord } from '@uaqa/contracts';
import { PageHeader } from '../components/index.ts';
import { SustainableAlternativesWorkspace } from '../features/alternatives/SustainableAlternativesWorkspace.tsx';
import type { WebApiClient } from '../lib/apiClient.ts';

export interface SustainableAlternativesPageProps {
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly airQualitySyncToken?: string | undefined;
  readonly onSessionIssue?: (error: unknown) => void;
}

export function SustainableAlternativesPage({
  profile,
  apiClient,
  airQualitySyncToken,
  onSessionIssue,
}: SustainableAlternativesPageProps) {
  return (
    <div className="space-y-6" data-testid="page-sustainable-alternatives">
      <PageHeader
        kicker="Sustainable Alternatives"
        title="Sustainable Alternatives Advisor"
        description={`Practical transport, home heating, everyday activity, and waste choices matched to your household in ${profile.city}.`}
      />

      <SustainableAlternativesWorkspace
        profile={profile}
        apiClient={apiClient}
        airQualitySyncToken={airQualitySyncToken}
        onSessionIssue={onSessionIssue}
      />
    </div>
  );
}
