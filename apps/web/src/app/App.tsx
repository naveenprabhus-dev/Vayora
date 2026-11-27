import type { AuthenticatedPrincipal, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { LogOut, Shield } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertBanner, Button, SkipLink, SurfaceCard } from '../components/index.ts';
import { ForgotPasswordForm } from '../features/auth/ForgotPasswordForm.tsx';
import { LoginForm } from '../features/auth/LoginForm.tsx';
import { RegisterForm } from '../features/auth/RegisterForm.tsx';
import { VerifyEmailScreen } from '../features/auth/VerifyEmailScreen.tsx';
import { getWorkspaceNavItem, type WorkspacePageId } from '../features/navigation/navConfig.ts';
import { WorkspaceShell } from '../features/navigation/WorkspaceShell.tsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { ApiClientError, createApiClient, type WebApiClient } from '../lib/apiClient.ts';
import {
  FirebaseAuthService,
  type AuthService,
  type AuthUserSnapshot,
} from '../lib/authService.ts';
import type { HouseholdStore } from '../lib/householdStore.ts';
import { createCachedWorkspaceApiClient } from '../lib/workspaceApiCache.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import {
  buildPublicUrl,
  buildWorkspaceUrl,
  parseWorkspacePageFromLocation,
  readInitialUrlState,
  type AppRoute,
} from './routing.ts';

const ResetPasswordForm = lazy(() =>
  import('../features/auth/ResetPasswordForm.tsx').then((mod) => ({
    default: mod.ResetPasswordForm,
  })),
);
const HouseholdOnboardingWizard = lazy(() =>
  import('../features/onboarding/HouseholdOnboardingWizard.tsx').then((mod) => ({
    default: mod.HouseholdOnboardingWizard,
  })),
);
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

function createLazyFirestoreStore(): HouseholdStore {
  let storePromise: Promise<HouseholdStore> | null = null;
  const loadStore = (): Promise<HouseholdStore> => {
    if (!storePromise) {
      storePromise = import('../lib/householdStore.ts').then(
        (mod) => new mod.FirestoreHouseholdStore(),
      );
    }
    return storePromise;
  };

  return {
    async syncVerifiedUserAccount(user, termsAcceptedAtIso) {
      const store = await loadStore();
      return store.syncVerifiedUserAccount(user, termsAcceptedAtIso);
    },
    async getHouseholdProfile(uid) {
      const store = await loadStore();
      return store.getHouseholdProfile(uid);
    },
    async saveHouseholdProfile(uid, input) {
      const store = await loadStore();
      return store.saveHouseholdProfile(uid, input);
    },
  };
}

function ModuleLoadingFallback({ label }: { readonly label: string }) {
  return (
    <SurfaceCard as="section">
      <output aria-live="polite" className="block text-sm text-slate-700">
        Loading {label}...
      </output>
    </SurfaceCard>
  );
}

export interface AppProps {
  readonly authService?: AuthService;
  readonly householdStore?: HouseholdStore;
  readonly apiClient?: WebApiClient;
}

const PUBLIC_TITLE_MAP: Readonly<Record<Exclude<AppRoute, 'workspace'>, string>> = {
  login: 'Sign In · Urban Air Quality Assistant',
  register: 'Create Account · Urban Air Quality Assistant',
  'forgot-password': 'Forgot Password · Urban Air Quality Assistant',
  'reset-password': 'Reset Password · Urban Air Quality Assistant',
  'verify-email': 'Verify Email · Urban Air Quality Assistant',
  onboarding: 'Household Onboarding · VAYORA',
};

function pushHistoryUrl(nextUrl: string, state: Record<string, unknown>, replace = false): void {
  if (typeof window === 'undefined') {
    return;
  }
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === nextUrl) {
    return;
  }
  if (replace) {
    window.history.replaceState(state, '', nextUrl);
  } else {
    window.history.pushState(state, '', nextUrl);
  }
}

function UrbanAirQualityAppShell({
  authService: injectedAuth,
  householdStore: injectedStore,
  apiClient: injectedApiClient,
}: AppProps) {
  const authService = useMemo(() => injectedAuth ?? new FirebaseAuthService(), [injectedAuth]);
  const householdStore = useMemo(
    () => injectedStore ?? createLazyFirestoreStore(),
    [injectedStore],
  );
  const rawApiClient = useMemo(
    () =>
      injectedApiClient ??
      createApiClient({
        getAccessToken: () => authService.getFreshIdToken(false),
      }),
    [injectedApiClient, authService],
  );
  const apiClient = useMemo(() => createCachedWorkspaceApiClient(rawApiClient), [rawApiClient]);

  const initialUrl = useMemo(() => readInitialUrlState(), []);
  const intendedWorkspacePageRef = useRef<WorkspacePageId | null>(initialUrl.intendedWorkspacePage);

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUserSnapshot | null>(null);
  const [principal, setPrincipal] = useState<AuthenticatedPrincipal | null>(null);
  const [householdProfile, setHouseholdProfile] = useState<HouseholdLifestyleRecord | null>(null);

  const [route, setRoute] = useState<AppRoute>(initialUrl.route);
  const [workspacePage, setWorkspacePage] = useState<WorkspacePageId>(initialUrl.workspacePage);
  const [oobCode, setOobCode] = useState<string | null>(initialUrl.oobCode);
  const [pendingTermsIso, setPendingTermsIso] = useState<string | undefined>(undefined);
  const [statusMessage, setStatusMessage] = useState<string | undefined>(
    initialUrl.blockedProtectedRoute
      ? 'Sign in with a verified household account to access protected onboarding routes.'
      : undefined,
  );
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSyncingSession, setIsSyncingSession] = useState(false);
  const [airQualitySyncToken, setAirQualitySyncToken] = useState<string | undefined>(undefined);

  const documentTitle =
    route === 'workspace'
      ? getWorkspaceNavItem(workspacePage).documentTitle
      : PUBLIC_TITLE_MAP[route];
  useDocumentTitle(documentTitle);

  const handleWorkspaceSessionIssue = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiClientError)) {
        return;
      }
      if (error.statusCode === 401) {
        apiClient.invalidateWorkspaceCache();
        void authService.logout();
        setUser(null);
        setPrincipal(null);
        setHouseholdProfile(null);
        setSessionError('Your session expired or was revoked. Please sign in again.');
        setRoute('login');
      } else if (error.statusCode === 403 && error.code === 'EMAIL_NOT_VERIFIED') {
        setPrincipal(null);
        setRoute('verify-email');
      }
    },
    [apiClient, authService],
  );

  const hydrateVerifiedWorkspace = useCallback(
    async (verifiedUser: AuthUserSnapshot, termsIso?: string) => {
      setIsSyncingSession(true);
      setSessionError(null);
      try {
        if (!injectedAuth) {
          void import('../lib/firebaseFirestore.ts').then(({ testFirestoreConnection }) =>
            testFirestoreConnection(),
          );
        }
        await authService.getFreshIdToken(true);
        const session = await apiClient.getAuthSession();

        if (!session.principal.emailVerified) {
          setPrincipal(null);
          setRoute('verify-email');
          return;
        }

        setPrincipal(session.principal);
        await householdStore.syncVerifiedUserAccount(verifiedUser, termsIso);

        let profile = await householdStore.getHouseholdProfile(verifiedUser.uid);
        if (!profile) {
          try {
            const apiProfile = await apiClient.getHouseholdProfile();
            profile = apiProfile.profile;
          } catch (error) {
            if (!(error instanceof ApiClientError && error.statusCode === 404)) {
              throw error;
            }
          }
        } else {
          try {
            await apiClient.getHouseholdProfile();
          } catch (error) {
            if (error instanceof ApiClientError && error.statusCode === 404) {
              const synced = await apiClient.saveHouseholdProfile({
                country: profile.country,
                city: profile.city,
                neighborhood: profile.neighborhood,
                postalPrefix: profile.postalPrefix,
                locationPreferences: profile.locationPreferences,
                householdSize: profile.householdSize,
                householdComposition: [...profile.householdComposition],
                primaryCommuteMode: profile.primaryCommuteMode,
                outdoorActivityPattern: profile.outdoorActivityPattern,
                ventilationContext: profile.ventilationContext,
                hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
                heatingType: profile.heatingType,
                lifestylePreferences: profile.lifestylePreferences,
                onboardingCompleted: profile.onboardingCompleted,
              });
              profile = synced.profile;
            } else {
              throw error;
            }
          }
        }

        setHouseholdProfile(profile);
        if (profile?.onboardingCompleted) {
          const targetPage =
            parseWorkspacePageFromLocation() ?? intendedWorkspacePageRef.current ?? 'overview';
          intendedWorkspacePageRef.current = null;
          setWorkspacePage(targetPage);
          setRoute('workspace');
          pushHistoryUrl(buildWorkspaceUrl(targetPage), { workspacePage: targetPage }, true);
        } else {
          setRoute('onboarding');
          pushHistoryUrl(buildPublicUrl('onboarding'), { route: 'onboarding' }, true);
        }
      } catch (error) {
        if (error instanceof ApiClientError && error.statusCode === 401) {
          apiClient.invalidateWorkspaceCache();
          await authService.logout();
          setUser(null);
          setPrincipal(null);
          setHouseholdProfile(null);
          setSessionError('Your session expired or was revoked. Please sign in again.');
          setRoute('login');
        } else if (error instanceof ApiClientError && error.statusCode === 403) {
          setPrincipal(null);
          setRoute('verify-email');
        } else {
          setSessionError(
            error instanceof Error
              ? error.message
              : 'Unable to verify your session with the backend server.',
          );
        }
      } finally {
        setIsSyncingSession(false);
      }
    },
    [apiClient, authService, householdStore, injectedAuth],
  );

  useEffect(() => {
    const unsubscribe = authService.subscribeAuthState((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        apiClient.invalidateWorkspaceCache();
        setPrincipal(null);
        setHouseholdProfile(null);
        setRoute((prev) =>
          prev === 'register' || prev === 'forgot-password' || prev === 'reset-password'
            ? prev
            : 'login',
        );
        return;
      }

      if (!nextUser.emailVerified) {
        setPrincipal(null);
        setRoute('verify-email');
        return;
      }

      void hydrateVerifiedWorkspace(nextUser, pendingTermsIso);
    });

    return () => unsubscribe();
  }, [apiClient, authService, hydrateVerifiedWorkspace, pendingTermsIso]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function handlePopState() {
      if (user && principal && householdProfile?.onboardingCompleted) {
        const nextPage = parseWorkspacePageFromLocation() ?? 'overview';
        setWorkspacePage(nextPage);
        setRoute('workspace');
        return;
      }

      const nextState = readInitialUrlState();
      setRoute(nextState.route);
      setOobCode(nextState.oobCode);
      if (nextState.blockedProtectedRoute) {
        intendedWorkspacePageRef.current = nextState.intendedWorkspacePage;
        setStatusMessage(
          'Sign in with a verified household account to access protected onboarding routes.',
        );
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [householdProfile, principal, user]);

  const handleSignOut = useCallback(async () => {
    apiClient.invalidateWorkspaceCache();
    intendedWorkspacePageRef.current = null;
    await authService.logout();
    setUser(null);
    setPrincipal(null);
    setHouseholdProfile(null);
    setSessionError(null);
    setStatusMessage('You have been signed out.');
    setRoute('login');
    pushHistoryUrl(buildPublicUrl('login'), { route: 'login' }, false);
  }, [apiClient, authService]);

  const navigatePublicRoute = useCallback((next: 'login' | 'register' | 'forgot-password') => {
    setSessionError(null);
    setStatusMessage(undefined);
    setOobCode(null);
    setRoute(next);
    pushHistoryUrl(buildPublicUrl(next), { route: next }, false);
  }, []);

  const navigateWorkspacePage = useCallback((nextPage: WorkspacePageId) => {
    setWorkspacePage(nextPage);
    setRoute('workspace');
    pushHistoryUrl(buildWorkspaceUrl(nextPage), { workspacePage: nextPage }, false);
  }, []);

  const handleProfileUpdated = useCallback(
    (updated: HouseholdLifestyleRecord) => {
      apiClient.invalidateWorkspaceCache();
      setHouseholdProfile(updated);
    },
    [apiClient],
  );

  const handleTelemetryUpdated = useCallback(
    (syncToken: string) => {
      apiClient.invalidateWorkspaceCache();
      setAirQualitySyncToken(syncToken);
    },
    [apiClient],
  );

  const isWorkspaceReady =
    authReady &&
    !isSyncingSession &&
    user !== null &&
    principal !== null &&
    route === 'workspace' &&
    householdProfile !== null;

  if (isWorkspaceReady) {
    return (
      <WorkspaceShell
        activePage={workspacePage}
        user={user}
        profile={householdProfile}
        onNavigate={navigateWorkspacePage}
        onSignOut={handleSignOut}
      >
        {sessionError ? (
          <AlertBanner tone="error" title="Session security notice">
            <p>{sessionError}</p>
          </AlertBanner>
        ) : null}

        <ErrorBoundary>
          <Suspense
            fallback={<ModuleLoadingFallback label={getWorkspaceNavItem(workspacePage).label} />}
          >
            {workspacePage === 'overview' ? (
              <OverviewPage
                user={user}
                profile={householdProfile}
                apiClient={apiClient}
                airQualitySyncToken={airQualitySyncToken}
                onNavigate={navigateWorkspacePage}
                onSessionIssue={handleWorkspaceSessionIssue}
              />
            ) : null}

            {workspacePage === 'air-quality' ? (
              <AirQualityPage
                userId={user.uid}
                profile={householdProfile}
                apiClient={apiClient}
                householdStore={householdStore}
                onProfileUpdated={handleProfileUpdated}
                onTelemetryUpdated={handleTelemetryUpdated}
                onSessionIssue={handleWorkspaceSessionIssue}
              />
            ) : null}

            {workspacePage === 'daily-routines' ? (
              <DailyRoutinesPage
                profile={householdProfile}
                apiClient={apiClient}
                airQualitySyncToken={airQualitySyncToken}
                onSessionIssue={handleWorkspaceSessionIssue}
              />
            ) : null}

            {workspacePage === 'indoor-air' ? (
              <IndoorAirPage
                profile={householdProfile}
                apiClient={apiClient}
                airQualitySyncToken={airQualitySyncToken}
                onSessionIssue={handleWorkspaceSessionIssue}
              />
            ) : null}

            {workspacePage === 'sustainable-alternatives' ? (
              <SustainableAlternativesPage
                profile={householdProfile}
                apiClient={apiClient}
                airQualitySyncToken={airQualitySyncToken}
                onSessionIssue={handleWorkspaceSessionIssue}
              />
            ) : null}

            {workspacePage === 'household' ? (
              <HouseholdPage
                user={user}
                principal={principal}
                profile={householdProfile}
                apiClient={apiClient}
                householdStore={householdStore}
                onProfileUpdated={handleProfileUpdated}
              />
            ) : null}

            {workspacePage === 'settings' ? (
              <SettingsPage
                user={user}
                principal={principal}
                profile={householdProfile}
                authService={authService}
                apiClient={apiClient}
                householdStore={householdStore}
                onProfileUpdated={handleProfileUpdated}
                onSignOut={handleSignOut}
                onSessionIssue={handleWorkspaceSessionIssue}
              />
            ) : null}
          </Suspense>
        </ErrorBoundary>
      </WorkspaceShell>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <SkipLink targetId="main-content" />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Shield className="h-5 w-5 shrink-0 text-[#0F5132]" aria-hidden="true" />
            <a
              href="#main-content"
              className="font-display text-base leading-snug font-bold tracking-tight text-slate-950 sm:text-lg"
            >
              VAYORA · Urban Air Quality Assistant
            </a>
          </div>

          <nav
            aria-label="Account navigation"
            className="flex flex-wrap items-center gap-2 sm:gap-3"
          >
            {user ? (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="hidden text-xs font-medium text-slate-700 sm:inline">
                  {user.email}
                </span>
                <Button type="button" variant="secondary" onClick={() => void handleSignOut()}>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={route === 'login' ? 'primary' : 'secondary'}
                  onClick={() => navigatePublicRoute('login')}
                >
                  Sign in
                </Button>
                <Button
                  type="button"
                  variant={route === 'register' ? 'primary' : 'secondary'}
                  onClick={() => navigatePublicRoute('register')}
                >
                  Create account
                </Button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-10"
      >
        {sessionError ? (
          <AlertBanner tone="error" title="Session security notice">
            <p>{sessionError}</p>
          </AlertBanner>
        ) : null}

        {!authReady || isSyncingSession ? (
          <SurfaceCard as="section" className="mx-auto max-w-lg">
            <output aria-live="polite" className="block space-y-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">Verifying session...</p>
              <p>Confirming authentication state and backend verification claims.</p>
            </output>
          </SurfaceCard>
        ) : null}

        {authReady && !isSyncingSession && route === 'login' && !user ? (
          <LoginForm
            authService={authService}
            statusMessage={statusMessage}
            onAuthenticated={async (loggedInUser) => {
              setStatusMessage(undefined);
              setUser(loggedInUser);
              if (!loggedInUser.emailVerified) {
                setRoute('verify-email');
                return;
              }
              await hydrateVerifiedWorkspace(loggedInUser);
            }}
            onNavigateRegister={() => navigatePublicRoute('register')}
            onNavigateForgotPassword={() => navigatePublicRoute('forgot-password')}
          />
        ) : null}

        {authReady && !isSyncingSession && route === 'register' && !user ? (
          <RegisterForm
            authService={authService}
            onRegistered={(registeredUser, acceptedAtIso) => {
              setPendingTermsIso(acceptedAtIso);
              setUser(registeredUser);
              setStatusMessage(undefined);
              setRoute('verify-email');
            }}
            onNavigateLogin={() => navigatePublicRoute('login')}
          />
        ) : null}

        {authReady && !isSyncingSession && route === 'forgot-password' && !user ? (
          <ForgotPasswordForm
            authService={authService}
            apiClient={apiClient}
            onNavigateLogin={() => navigatePublicRoute('login')}
          />
        ) : null}

        {authReady && !isSyncingSession && route === 'reset-password' ? (
          <Suspense fallback={<ModuleLoadingFallback label="password reset" />}>
            <ResetPasswordForm
              key={oobCode ?? ''}
              oobCode={oobCode ?? ''}
              authService={authService}
              onResetComplete={() => {
                setOobCode(null);
                setStatusMessage('Your password has been updated. Sign in with your new password.');
                setRoute('login');
                pushHistoryUrl(buildPublicUrl('login'), { route: 'login' }, false);
              }}
              onRequestNewLink={() => navigatePublicRoute('forgot-password')}
            />
          </Suspense>
        ) : null}

        {authReady && !isSyncingSession && route === 'verify-email' && user ? (
          <VerifyEmailScreen
            user={user}
            authService={authService}
            apiClient={apiClient}
            initialOobCode={oobCode}
            onVerified={async (verifiedUser) => {
              setOobCode(null);
              setUser(verifiedUser);
              await hydrateVerifiedWorkspace(verifiedUser, pendingTermsIso);
            }}
            onSignOut={handleSignOut}
          />
        ) : null}

        {authReady && !isSyncingSession && user && principal && route === 'onboarding' ? (
          <Suspense fallback={<ModuleLoadingFallback label="household setup" />}>
            <HouseholdOnboardingWizard
              user={user}
              initialProfile={householdProfile}
              isEditingExisting={false}
              apiClient={apiClient}
              householdStore={householdStore}
              onSaved={(savedRecord, completed) => {
                apiClient.invalidateWorkspaceCache();
                setHouseholdProfile(savedRecord);
                if (completed) {
                  const targetPage = intendedWorkspacePageRef.current ?? 'overview';
                  intendedWorkspacePageRef.current = null;
                  setStatusMessage('Your household location and lifestyle preferences are saved.');
                  setWorkspacePage(targetPage);
                  setRoute('workspace');
                  pushHistoryUrl(
                    buildWorkspaceUrl(targetPage),
                    { workspacePage: targetPage },
                    true,
                  );
                }
              }}
            />
          </Suspense>
        ) : null}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-slate-600">
          <p>
            VAYORA · Urban Air Quality Assistant · Intelligence, Routines, Indoor Air &amp;
            Alternatives
          </p>
          <p>Verified Accounts Only · WCAG 2.2 AA · Open-Meteo CC BY 4.0</p>
        </div>
      </footer>
    </div>
  );
}

export function App(props: AppProps = {}) {
  return (
    <ErrorBoundary landmark="main">
      <UrbanAirQualityAppShell {...props} />
    </ErrorBoundary>
  );
}

export default App;
