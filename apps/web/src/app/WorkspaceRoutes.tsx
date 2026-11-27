import type { AuthenticatedPrincipal, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { Suspense, lazy } from 'react';
import { SurfaceCard } from '../components/index.ts';
import { getWorkspaceNavItem, type WorkspacePageId } from '../features/navigation/navConfig.ts';
import type { AuthService, AuthUserSnapshot } from '../lib/authService.ts';
import type { HouseholdStore } from '../lib/householdStore.ts';
import type { WorkspaceCachedApiClient } from '../lib/workspaceApiCache.ts';

const OverviewPage = lazy(() =>
  import('../pages/OverviewPage.tsx').then((mod) => ({
    default: mod.OverviewPage,
  })),
);
const AirQualityPage = lazy(() =>
  import('../pages/AirQualityPage.tsx').then((mod) => ({
    default: mod.AirQualityPage,
  })),
);
const DailyRoutinesPage = lazy(() =>
  import('../pages/DailyRoutinesPage.tsx').then((mod) => ({
    default: mod.DailyRoutinesPage,
  })),
);
const IndoorAirPage = lazy(() =>
  import('../pages/IndoorAirPage.tsx').then((mod) => ({
    default: mod.IndoorAirPage,
  })),
);
const SustainableAlternativesPage = lazy(() =>
  import('../pages/SustainableAlternativesPage.tsx').then((mod) => ({
    default: mod.SustainableAlternativesPage,
  })),
);
const HouseholdPage = lazy(() =>
  import('../pages/HouseholdPage.tsx').then((mod) => ({
    default: mod.HouseholdPage,
  })),
);
const SettingsPage = lazy(() =>
  import('../pages/SettingsPage.tsx').then((mod) => ({
    default: mod.SettingsPage,
  })),
);

export function ModuleLoadingFallback({ label }: { readonly label: string }) {
  return (
    <SurfaceCard as="section">
      <output aria-live="polite" className="block text-sm text-slate-700">
        Loading {label}...
      </output>
    </SurfaceCard>
  );
}

export interface WorkspaceRoutesProps {
  readonly workspacePage: WorkspacePageId;
  readonly user: AuthUserSnapshot;
  readonly principal: AuthenticatedPrincipal;
  readonly profile: HouseholdLifestyleRecord;
  readonly authService: AuthService;
  readonly apiClient: WorkspaceCachedApiClient;
  readonly householdStore: HouseholdStore;
  readonly airQualitySyncToken: string | undefined;
  readonly onNavigate: (pageId: WorkspacePageId) => void;
  readonly onProfileUpdated: (updated: HouseholdLifestyleRecord) => void;
  readonly onTelemetryUpdated: (syncToken: string) => void;
  readonly onSessionIssue: (error: unknown) => void;
  readonly onSignOut: () => Promise<void>;
}

export function WorkspaceRoutes({
  workspacePage,
  user,
  principal,
  profile,
  authService,
  apiClient,
  householdStore,
  airQualitySyncToken,
  onNavigate,
  onProfileUpdated,
  onTelemetryUpdated,
  onSessionIssue,
  onSignOut,
}: WorkspaceRoutesProps) {
  return (
    <Suspense fallback={<ModuleLoadingFallback label={getWorkspaceNavItem(workspacePage).label} />}>
      {workspacePage === 'overview' ? (
        <OverviewPage
          user={user}
          profile={profile}
          apiClient={apiClient}
          airQualitySyncToken={airQualitySyncToken}
          onNavigate={onNavigate}
          onSessionIssue={onSessionIssue}
        />
      ) : null}

      {workspacePage === 'air-quality' ? (
        <AirQualityPage
          userId={user.uid}
          profile={profile}
          apiClient={apiClient}
          householdStore={householdStore}
          onProfileUpdated={onProfileUpdated}
          onTelemetryUpdated={onTelemetryUpdated}
          onSessionIssue={onSessionIssue}
        />
      ) : null}

      {workspacePage === 'daily-routines' ? (
        <DailyRoutinesPage
          profile={profile}
          apiClient={apiClient}
          airQualitySyncToken={airQualitySyncToken}
          onSessionIssue={onSessionIssue}
        />
      ) : null}

      {workspacePage === 'indoor-air' ? (
        <IndoorAirPage
          profile={profile}
          apiClient={apiClient}
          airQualitySyncToken={airQualitySyncToken}
          onSessionIssue={onSessionIssue}
        />
      ) : null}

      {workspacePage === 'sustainable-alternatives' ? (
        <SustainableAlternativesPage
          profile={profile}
          apiClient={apiClient}
          airQualitySyncToken={airQualitySyncToken}
          onSessionIssue={onSessionIssue}
        />
      ) : null}

      {workspacePage === 'household' ? (
        <HouseholdPage
          user={user}
          principal={principal}
          profile={profile}
          apiClient={apiClient}
          householdStore={householdStore}
          onProfileUpdated={onProfileUpdated}
        />
      ) : null}

      {workspacePage === 'settings' ? (
        <SettingsPage
          user={user}
          principal={principal}
          profile={profile}
          authService={authService}
          apiClient={apiClient}
          householdStore={householdStore}
          onProfileUpdated={onProfileUpdated}
          onSignOut={onSignOut}
          onSessionIssue={onSessionIssue}
        />
      ) : null}
    </Suspense>
  );
}
