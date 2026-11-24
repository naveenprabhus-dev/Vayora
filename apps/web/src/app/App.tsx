import type { AuthenticatedPrincipal, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { LogOut, Shield } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertBanner, Button, SkipLink, SurfaceCard } from '../components/index.ts';
import { ForgotPasswordForm } from '../features/auth/ForgotPasswordForm.tsx';
import { LoginForm } from '../features/auth/LoginForm.tsx';
import { RegisterForm } from '../features/auth/RegisterForm.tsx';
import { VerifyEmailScreen } from '../features/auth/VerifyEmailScreen.tsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { ApiClientError, createApiClient, type WebApiClient } from '../lib/apiClient.ts';
import {
  FirebaseAuthService,
  type AuthService,
  type AuthUserSnapshot,
} from '../lib/authService.ts';
import type { HouseholdStore } from '../lib/householdStore.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';

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
const VerifiedProfileSummary = lazy(() =>
  import('../features/onboarding/VerifiedProfileSummary.tsx').then((mod) => ({
    default: mod.VerifiedProfileSummary,
  })),
);
const PersonalizedAdvisoryWorkspace = lazy(() =>
  import('../features/advisory/PersonalizedAdvisoryWorkspace.tsx').then((mod) => ({
    default: mod.PersonalizedAdvisoryWorkspace,
  })),
);
const AirQualityDashboard = lazy(() =>
  import('../features/air-quality/AirQualityDashboard.tsx').then((mod) => ({
    default: mod.AirQualityDashboard,
  })),
);
const DailyRoutinesWorkspace = lazy(() =>
  import('../features/routines/DailyRoutinesWorkspace.tsx').then((mod) => ({
    default: mod.DailyRoutinesWorkspace,
  })),
);
const IndoorAirAssistantWorkspace = lazy(() =>
  import('../features/indoor/IndoorAirAssistantWorkspace.tsx').then((mod) => ({
    default: mod.IndoorAirAssistantWorkspace,
  })),
);
const SustainableAlternativesWorkspace = lazy(() =>
  import('../features/alternatives/SustainableAlternativesWorkspace.tsx').then((mod) => ({
    default: mod.SustainableAlternativesWorkspace,
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

export type AppRoute =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-password'
  | 'verify-email'
  | 'onboarding'
  | 'account-ready';

export interface AppProps {
  readonly authService?: AuthService;
  readonly householdStore?: HouseholdStore;
  readonly apiClient?: WebApiClient;
}

const TITLE_MAP: Readonly<Record<AppRoute, string>> = {
  login: 'Sign In · Urban Air Quality Assistant',
  register: 'Create Account · Urban Air Quality Assistant',
  'forgot-password': 'Forgot Password · Urban Air Quality Assistant',
  'reset-password': 'Reset Password · Urban Air Quality Assistant',
  'verify-email': 'Verify Email · Urban Air Quality Assistant',
  onboarding: 'Household Onboarding · VAYORA',
  'account-ready': 'Air Quality, Routines, Indoor & Alternatives · VAYORA',
};

function readInitialUrlState(): {
  route: AppRoute;
  oobCode: string | null;
  blockedProtectedRoute: boolean;
} {
  if (typeof window === 'undefined') {
    return { route: 'login', oobCode: null, blockedProtectedRoute: false };
  }
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  const view = params.get('view');

  if (mode === 'resetPassword') {
    return { route: 'reset-password', oobCode: oobCode ?? '', blockedProtectedRoute: false };
  }
  if (mode === 'verifyEmail' && oobCode) {
    return { route: 'verify-email', oobCode, blockedProtectedRoute: false };
  }
  if (view === 'register') {
    return { route: 'register', oobCode: null, blockedProtectedRoute: false };
  }
  if (view === 'forgot-password') {
    return { route: 'forgot-password', oobCode: null, blockedProtectedRoute: false };
  }
  if (view === 'onboarding' || view === 'account-ready' || view === 'dashboard') {
    return { route: 'login', oobCode: null, blockedProtectedRoute: true };
  }
  return { route: 'login', oobCode: null, blockedProtectedRoute: false };
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
  const apiClient = useMemo(
    () =>
      injectedApiClient ??
      createApiClient({
        getAccessToken: () => authService.getFreshIdToken(false),
      }),
    [injectedApiClient, authService],
  );

  const initialUrl = useMemo(() => readInitialUrlState(), []);

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUserSnapshot | null>(null);
  const [principal, setPrincipal] = useState<AuthenticatedPrincipal | null>(null);
  const [householdProfile, setHouseholdProfile] = useState<HouseholdLifestyleRecord | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [route, setRoute] = useState<AppRoute>(initialUrl.route);
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
  const [activeSectionId, setActiveSectionId] = useState<string>('personalized-advisory-heading');

  useDocumentTitle(TITLE_MAP[route]);

  const handleWorkspaceSessionIssue = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiClientError)) {
        return;
      }
      if (error.statusCode === 401) {
        void authService.logout();
        setUser(null);
        setPrincipal(null);
        setHouseholdProfile(null);
        setIsEditingProfile(false);
        setSessionError('Your session expired or was revoked. Please sign in again.');
        setRoute('login');
      } else if (error.statusCode === 403 && error.code === 'EMAIL_NOT_VERIFIED') {
        setPrincipal(null);
        setRoute('verify-email');
      }
    },
    [authService],
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
        setIsEditingProfile(false);
        setRoute(profile?.onboardingCompleted ? 'account-ready' : 'onboarding');
      } catch (error) {
        if (error instanceof ApiClientError && error.statusCode === 401) {
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
        setPrincipal(null);
        setHouseholdProfile(null);
        setIsEditingProfile(false);
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
  }, [authService, hydrateVerifiedWorkspace, pendingTermsIso]);

  const handleSignOut = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setPrincipal(null);
    setHouseholdProfile(null);
    setIsEditingProfile(false);
    setSessionError(null);
    setStatusMessage('You have been signed out.');
    setRoute('login');
  }, [authService]);

  const navigatePublicRoute = useCallback((next: 'login' | 'register' | 'forgot-password') => {
    setSessionError(null);
    setStatusMessage(undefined);
    setOobCode(null);
    setRoute(next);
  }, []);

  const handleSectionJump = useCallback((sectionId: string) => {
    setActiveSectionId(sectionId);
    if (typeof document !== 'undefined') {
      const target = document.getElementById(sectionId);
      target?.focus();
    }
  }, []);

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

        {authReady &&
        !isSyncingSession &&
        user &&
        principal &&
        (route === 'onboarding' || isEditingProfile) ? (
          <Suspense fallback={<ModuleLoadingFallback label="household setup" />}>
            <HouseholdOnboardingWizard
              user={user}
              initialProfile={householdProfile}
              isEditingExisting={isEditingProfile}
              apiClient={apiClient}
              householdStore={householdStore}
              onSaved={(savedRecord, completed) => {
                setHouseholdProfile(savedRecord);
                if (completed) {
                  setIsEditingProfile(false);
                  setStatusMessage('Your household location and lifestyle preferences are saved.');
                  setRoute('account-ready');
                }
              }}
              onCancelEdit={
                isEditingProfile
                  ? () => {
                      setIsEditingProfile(false);
                      setRoute('account-ready');
                    }
                  : undefined
              }
            />
          </Suspense>
        ) : null}

        {authReady &&
        !isSyncingSession &&
        user &&
        principal &&
        route === 'account-ready' &&
        !isEditingProfile &&
        householdProfile ? (
          <div className="space-y-8">
            <Suspense fallback={<ModuleLoadingFallback label="household summary" />}>
              <VerifiedProfileSummary
                user={user}
                principal={principal}
                profile={householdProfile}
                statusMessage={statusMessage}
                onEditProfile={() => {
                  setStatusMessage(undefined);
                  setIsEditingProfile(true);
                }}
              />
            </Suspense>

            <nav
              aria-label="Workspace sections"
              className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border-y border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
            >
              {[
                { id: 'personalized-advisory-heading', label: 'Personalized Briefing' },
                { id: 'air-quality-location-heading', label: 'Air Quality Intelligence' },
                { id: 'daily-routines-heading', label: 'Low-Emission Daily Routines' },
                { id: 'indoor-air-heading', label: 'Indoor Air Quality Assistant' },
                { id: 'sustainable-alternatives-heading', label: 'Sustainable Alternatives' },
              ].map((section, index) => {
                const isActive = activeSectionId === section.id;
                return (
                  <span key={section.id} className="inline-flex items-center gap-x-5">
                    {index > 0 ? (
                      <span aria-hidden="true" className="text-slate-300">
                        /
                      </span>
                    ) : null}
                    <a
                      href={`#${section.id}`}
                      aria-current={isActive ? 'location' : undefined}
                      onClick={() => handleSectionJump(section.id)}
                      className={`underline-offset-4 hover:text-[#0F5132] hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#0F5132] focus-visible:outline-none ${
                        isActive ? 'text-[#0F5132] underline' : ''
                      }`}
                    >
                      {section.label}
                    </a>
                  </span>
                );
              })}
            </nav>

            <Suspense fallback={<ModuleLoadingFallback label="Personalized Briefing" />}>
              <PersonalizedAdvisoryWorkspace
                profile={householdProfile}
                apiClient={apiClient}
                airQualitySyncToken={airQualitySyncToken}
                onSessionIssue={handleWorkspaceSessionIssue}
              />
            </Suspense>

            <Suspense fallback={<ModuleLoadingFallback label="Air Quality Intelligence" />}>
              <AirQualityDashboard
                userId={user.uid}
                profile={householdProfile}
                apiClient={apiClient}
                householdStore={householdStore}
                onProfileUpdated={(updated) => setHouseholdProfile(updated)}
                onTelemetryUpdated={setAirQualitySyncToken}
                onSessionIssue={handleWorkspaceSessionIssue}
              />
            </Suspense>

            <Suspense fallback={<ModuleLoadingFallback label="Low-Emission Daily Routines" />}>
              <DailyRoutinesWorkspace
                profile={householdProfile}
                apiClient={apiClient}
                airQualitySyncToken={airQualitySyncToken}
                onSessionIssue={handleWorkspaceSessionIssue}
              />
            </Suspense>

            <Suspense fallback={<ModuleLoadingFallback label="Indoor Air Quality Assistant" />}>
              <IndoorAirAssistantWorkspace
                profile={householdProfile}
                apiClient={apiClient}
                airQualitySyncToken={airQualitySyncToken}
                onSessionIssue={handleWorkspaceSessionIssue}
              />
            </Suspense>

            <Suspense fallback={<ModuleLoadingFallback label="Sustainable Alternatives" />}>
              <SustainableAlternativesWorkspace
                profile={householdProfile}
                apiClient={apiClient}
                airQualitySyncToken={airQualitySyncToken}
                onSessionIssue={handleWorkspaceSessionIssue}
              />
            </Suspense>
          </div>
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
    <ErrorBoundary>
      <UrbanAirQualityAppShell {...props} />
    </ErrorBoundary>
  );
}

export default App;
