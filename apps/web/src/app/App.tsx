import type { AuthenticatedPrincipal, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { LogOut, Shield } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertBanner, Button, SkipLink, SurfaceCard } from '../components/index.ts';
import { ForgotPasswordForm } from '../features/auth/ForgotPasswordForm.tsx';
import { LoginForm } from '../features/auth/LoginForm.tsx';
import { RegisterForm } from '../features/auth/RegisterForm.tsx';
import { ResetPasswordForm } from '../features/auth/ResetPasswordForm.tsx';
import { VerifyEmailScreen } from '../features/auth/VerifyEmailScreen.tsx';
import { HouseholdOnboardingWizard } from '../features/onboarding/HouseholdOnboardingWizard.tsx';
import { VerifiedProfileSummary } from '../features/onboarding/VerifiedProfileSummary.tsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { ApiClientError, createApiClient, type WebApiClient } from '../lib/apiClient.ts';
import {
  FirebaseAuthService,
  type AuthService,
  type AuthUserSnapshot,
} from '../lib/authService.ts';
import { testFirestoreConnection } from '../lib/firebase.ts';
import { FirestoreHouseholdStore, type HouseholdStore } from '../lib/householdStore.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';

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
  onboarding: 'Household Onboarding · Urban Air Quality Assistant',
  'account-ready': 'Verified Household Profile · Urban Air Quality Assistant',
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
    () => injectedStore ?? new FirestoreHouseholdStore(),
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

  useDocumentTitle(TITLE_MAP[route]);

  const hydrateVerifiedWorkspace = useCallback(
    async (verifiedUser: AuthUserSnapshot, termsIso?: string) => {
      setIsSyncingSession(true);
      setSessionError(null);
      try {
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
    [apiClient, authService, householdStore],
  );

  useEffect(() => {
    if (!injectedAuth) {
      void testFirestoreConnection();
    }

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
  }, [authService, hydrateVerifiedWorkspace, injectedAuth, pendingTermsIso]);

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
              Urban Air Quality Assistant
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
        ) : null}

        {authReady &&
        !isSyncingSession &&
        user &&
        principal &&
        route === 'account-ready' &&
        !isEditingProfile &&
        householdProfile ? (
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
        ) : null}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-slate-600">
          <p>Urban Air Quality Assistant · Phase 1 Identity &amp; Household Onboarding</p>
          <p>Verified Accounts Only · WCAG 2.2 AA · Server-Verified RBAC</p>
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
