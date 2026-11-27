import { LogOut, Shield } from 'lucide-react';
import type { ReactNode } from 'react';
import { AlertBanner, Button, SkipLink } from '../components/index.ts';
import type { AuthUserSnapshot } from '../lib/authService.ts';
import type { AppRoute } from './routing.ts';

export interface PublicAuthLayoutProps {
  readonly route: Exclude<AppRoute, 'workspace'>;
  readonly user: AuthUserSnapshot | null;
  readonly sessionError: string | null;
  readonly onNavigatePublic: (route: 'login' | 'register' | 'forgot-password') => void;
  readonly onSignOut: () => Promise<void>;
  readonly children: ReactNode;
}

export function PublicAuthLayout({
  route,
  user,
  sessionError,
  onNavigatePublic,
  onSignOut,
  children,
}: PublicAuthLayoutProps) {
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
                <Button type="button" variant="secondary" onClick={() => void onSignOut()}>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={route === 'login' ? 'primary' : 'secondary'}
                  onClick={() => onNavigatePublic('login')}
                >
                  Sign in
                </Button>
                <Button
                  type="button"
                  variant={route === 'register' ? 'primary' : 'secondary'}
                  onClick={() => onNavigatePublic('register')}
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

        {children}
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
