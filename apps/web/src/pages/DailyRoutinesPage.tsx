import type { HouseholdLifestyleRecord } from '@uaqa/contracts';
import { PageHeader } from '../components/index.ts';
import { DailyRoutinesWorkspace } from '../features/routines/DailyRoutinesWorkspace.tsx';
import type { WebApiClient } from '../lib/apiClient.ts';

export interface DailyRoutinesPageProps {
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly airQualitySyncToken?: string | undefined;
  readonly onSessionIssue?: (error: unknown) => void;
}

export function DailyRoutinesPage({
  profile,
  apiClient,
  airQualitySyncToken,
  onSessionIssue,
}: DailyRoutinesPageProps) {
  return (
    <div className="space-y-6" data-testid="page-daily-routines">
      <PageHeader
        kicker="Daily Routines"
        title="Low-Emission Daily Routines"
        description={`Cleaner outdoor windows, commute options, and exposure-vs-emission trade-offs tailored for ${profile.neighborhood}, ${profile.city}.`}
      />

      <DailyRoutinesWorkspace
        profile={profile}
        apiClient={apiClient}
        airQualitySyncToken={airQualitySyncToken}
        onSessionIssue={onSessionIssue}
      />
    </div>
  );
}
