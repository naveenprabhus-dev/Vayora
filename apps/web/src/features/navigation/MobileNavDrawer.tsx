import { LogOut, Shield, X } from 'lucide-react';
import { useEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { buildWorkspaceUrl } from '../../app/routing.ts';
import type { AuthUserSnapshot } from '../../lib/authService.ts';
import { WORKSPACE_NAV_ITEMS, type WorkspacePageId } from './navConfig.ts';

export interface MobileNavDrawerProps {
  readonly isOpen: boolean;
  readonly activePage: WorkspacePageId;
  readonly user: AuthUserSnapshot;
  readonly returnFocusRef: RefObject<HTMLButtonElement | null>;
  readonly onClose: (restoreFocus?: boolean) => void;
  readonly onNavigate: (pageId: WorkspacePageId) => void;
  readonly onSignOut: () => Promise<void> | void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNavDrawer({
  isOpen,
  activePage,
  user,
  returnFocusRef,
  onClose,
  onNavigate,
  onSignOut,
}: MobileNavDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move initial focus to the accessible Close button inside the modal drawer.
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose(true);
        returnFocusRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) {
        return;
      }

      const focusables = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose, returnFocusRef]);

  if (!isOpen) {
    return null;
  }

  const workspaceItems = WORKSPACE_NAV_ITEMS.filter((item) => item.group === 'workspace');
  const accountItems = WORKSPACE_NAV_ITEMS.filter((item) => item.group === 'account');

  function handleDismiss() {
    onClose(true);
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }

  function handleSelectPage(event: MouseEvent<HTMLAnchorElement>, pageId: WorkspacePageId) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onClose(false);
    onNavigate(pageId);
  }

  function renderDrawerItems(items: typeof WORKSPACE_NAV_ITEMS) {
    return items.map((item) => {
      const Icon = item.Icon;
      const isActive = activePage === item.id;
      return (
        <a
          key={item.id}
          href={buildWorkspaceUrl(item.id)}
          aria-current={isActive ? 'page' : undefined}
          data-testid={`mobile-nav-${item.id}`}
          onClick={(e) => handleSelectPage(e, item.id)}
          className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132] ${
            isActive
              ? 'border-emerald-200 bg-emerald-50 font-semibold text-[#0F5132]'
              : 'border-transparent font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950'
          }`}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{item.label}</span>
        </a>
      );
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <div
        aria-hidden="true"
        data-testid="mobile-drawer-backdrop"
        onClick={handleDismiss}
        className="fixed inset-0 bg-slate-950/45 transition-opacity duration-200"
      />

      <div
        ref={drawerRef}
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
        className="relative z-10 flex h-full w-[280px] max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl"
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 shrink-0 text-[#0F5132]" aria-hidden="true" />
            <span className="font-display text-base font-bold tracking-tight text-slate-950">
              VAYORA
            </span>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close navigation menu"
            data-testid="mobile-menu-close"
            onClick={handleDismiss}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label="Mobile primary navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        >
          <div className="space-y-1">{renderDrawerItems(workspaceItems)}</div>
          <div role="separator" className="my-3 border-t border-slate-200" />
          <div className="space-y-1">{renderDrawerItems(accountItems)}</div>
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3">
            <p className="truncate text-xs font-semibold text-slate-950">{user.displayName}</p>
            <p className="truncate text-xs text-slate-600">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose(false);
              void onSignOut();
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
