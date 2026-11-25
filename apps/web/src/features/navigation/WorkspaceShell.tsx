import type { HouseholdLifestyleRecord } from '@uaqa/contracts';
import { Menu, Shield } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { SkipLink } from '../../components/index.ts';
import type { AuthUserSnapshot } from '../../lib/authService.ts';
import { DesktopSidebar } from './DesktopSidebar.tsx';
import { MobileNavDrawer } from './MobileNavDrawer.tsx';
import { getWorkspaceNavItem, type WorkspacePageId } from './navConfig.ts';

export interface WorkspaceShellProps {
  readonly activePage: WorkspacePageId;
  readonly user: AuthUserSnapshot;
  readonly profile: HouseholdLifestyleRecord;
  readonly onNavigate: (pageId: WorkspacePageId) => void;
  readonly onSignOut: () => Promise<void> | void;
  readonly children: ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'vayora.sidebar.collapsed';

function readInitialSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function WorkspaceShell({
  activePage,
  user,
  profile,
  onNavigate,
  onSignOut,
  children,
}: WorkspaceShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(readInitialSidebarCollapsed);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activeNavItem = getWorkspaceNavItem(activePage);

  const handleToggleCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage write restriction
      }
      return next;
    });
  }, []);

  const handleCloseMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const handleNavigate = useCallback(
    (pageId: WorkspacePageId) => {
      onNavigate(pageId);
      if (typeof document !== 'undefined') {
        const mainEl = document.getElementById('main-content');
        mainEl?.focus();
      }
    },
    [onNavigate],
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <SkipLink targetId="main-content" />

      <DesktopSidebar
        activePage={activePage}
        isCollapsed={isSidebarCollapsed}
        user={user}
        onToggleCollapse={handleToggleCollapse}
        onNavigate={handleNavigate}
        onSignOut={onSignOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                ref={mobileMenuTriggerRef}
                type="button"
                data-testid="mobile-menu-trigger"
                aria-label="Open navigation menu"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-navigation-drawer"
                onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132] lg:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="flex min-w-0 items-center gap-2 text-sm">
                <Shield className="h-4 w-4 shrink-0 text-[#0F5132] lg:hidden" aria-hidden="true" />
                <span className="font-display font-bold tracking-tight text-slate-950 whitespace-nowrap lg:hidden">
                  VAYORA
                </span>
                <span aria-hidden="true" className="text-slate-300 lg:hidden">
                  /
                </span>
                <span className="truncate font-semibold text-slate-900">{activeNavItem.label}</span>
                <span aria-hidden="true" className="hidden text-slate-300 sm:inline">
                  ·
                </span>
                <span className="hidden truncate text-xs text-slate-600 sm:inline">
                  {profile.neighborhood}, {profile.city}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden truncate text-xs font-medium text-slate-700 md:inline">
                {user.email}
              </span>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 focus:outline-none sm:px-6 sm:py-8 lg:px-8"
        >
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 text-xs text-slate-600 sm:px-6 lg:px-8">
            <p>VAYORA · Urban Air Quality Assistant</p>
            <p>Verified Accounts Only · WCAG 2.2 AA · Open-Meteo CC BY 4.0</p>
          </div>
        </footer>
      </div>

      <MobileNavDrawer
        isOpen={isMobileMenuOpen}
        activePage={activePage}
        user={user}
        returnFocusRef={mobileMenuTriggerRef}
        onClose={handleCloseMobileMenu}
        onNavigate={handleNavigate}
        onSignOut={onSignOut}
      />
    </div>
  );
}
