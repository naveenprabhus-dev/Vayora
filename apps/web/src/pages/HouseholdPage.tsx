import type { AuthenticatedPrincipal, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { Lock, Pencil } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { Button, PageHeader, SurfaceCard } from '../components/index.ts';
import { VerifiedProfileSummary } from '../features/onboarding/VerifiedProfileSummary.tsx';
import type { WebApiClient } from '../lib/apiClient.ts';
import type { AuthUserSnapshot } from '../lib/authService.ts';
import type { HouseholdStore } from '../lib/householdStore.ts';

const HouseholdOnboardingWizard = lazy(() =>
  import('../features/onboarding/HouseholdOnboardingWizard.tsx').then((mod) => ({
    default: mod.HouseholdOnboardingWizard,
  })),
);

export interface HouseholdPageProps {
  readonly user: AuthUserSnapshot;
  readonly principal: AuthenticatedPrincipal;
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly householdStore: HouseholdStore;
  readonly onProfileUpdated: (updated: HouseholdLifestyleRecord) => void;
}

export function HouseholdPage({
  user,
  principal,
  profile,
  apiClient,
  householdStore,
  onProfileUpdated,
}: HouseholdPageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);

  return (
    <div className="space-y-6" data-testid="page-household">
      <PageHeader
        kicker="Household Profile"
        title="My Household"
        description="Manage your saved location zone, household composition, commute pattern, and indoor ventilation setup."
        actions={
          !isEditing ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStatusMessage(undefined);
                setIsEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit preferences
            </Button>
          ) : null
        }
      />

      {isEditing ? (
        <Suspense
          fallback={
            <SurfaceCard as="section">
              <output aria-live="polite" className="block text-sm text-slate-700">
                Loading household editor...
              </output>
            </SurfaceCard>
          }
        >
          <HouseholdOnboardingWizard
            user={user}
            initialProfile={profile}
            isEditingExisting
            apiClient={apiClient}
            householdStore={householdStore}
            onSaved={(savedRecord) => {
              onProfileUpdated(savedRecord);
              setStatusMessage('Your household location and lifestyle preferences are saved.');
              setIsEditing(false);
            }}
            onCancelEdit={() => setIsEditing(false)}
          />
        </Suspense>
      ) : (
        <>
          <VerifiedProfileSummary
            user={user}
            principal={principal}
            profile={profile}
            statusMessage={statusMessage}
            hideTopHero
            hideEditAction
            onEditProfile={() => {
              setStatusMessage(undefined);
              setIsEditing(true);
            }}
          />

          <SurfaceCard as="section" aria-labelledby="household-ownership-heading">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#0F5132]" aria-hidden="true" />
              <div className="space-y-1.5 text-sm">
                <h2 id="household-ownership-heading" className="font-semibold text-slate-950">
                  Account-Scoped Persistence &amp; Data Isolation
                </h2>
                <p className="text-slate-700">
                  Your household record is bound strictly to your verified owner ID (
                  <span className="font-mono text-xs text-slate-900">{profile.ownerUid}</span>) and
                  enforced by Firestore security rules and server-verified API authorization. Other
                  household accounts cannot read or modify your settings.
                </p>
              </div>
            </div>
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
