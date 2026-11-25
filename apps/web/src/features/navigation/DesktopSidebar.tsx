import { LogOut, PanelLeftClose, PanelLeftOpen, Shield } from 'lucide-react';
import type { MouseEvent } from 'react';
import { buildWorkspaceUrl } from '../../app/routing.ts';
import type { AuthUserSnapshot } from '../../lib/authService.ts';
import { WORKSPACE_NAV_ITEMS, type WorkspacePageId } from './navConfig.ts';

export interface DesktopSidebarProps {
  readonly activePage: WorkspacePageId;
  readonly isCollapsed: boolean;
  readonly user: AuthUserSnapshot;
  readonly onToggleCollapse: () => void;
  readonly onNavigate: (pageId: WorkspacePageId) => void;
  readonly onSignOut: () => Promise<void> | void;
}

export function DesktopSidebar({
  activePage,
  isCollapsed,
  user,
  onToggleCollapse,
  onNavigate,
  onSignOut,
}: DesktopSidebarProps) {
  const workspaceItems = WORKSPACE_NAV_ITEMS.filter((item) => item.group === 'workspace');
  const accountItems = WORKSPACE_NAV_ITEMS.filter((item) => item.group === 'account');

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, pageId: WorkspacePageId) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onNavigate(pageId);
  }

  function renderNavItems(items: typeof WORKSPACE_NAV_ITEMS) {
    return items.map((item) => {
      const Icon = item.Icon;
      const isActive = activePage === item.id;
      const href = buildWorkspaceUrl(item.id);

      return (
        <a
          key={item.id}
          href={href}
          aria-current={isActive ? 'page' : undefined}
          aria-label={item.label}
          title={isCollapsed ? item.label : undefined}
          data-testid={`sidebar-nav-${item.id}`}
          onClick={(e) => handleNavClick(e, item.id)}
          className={`group relative flex min-h-11 items-center rounded-lg border text-sm whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132] ${
            isCollapsed ? 'justify-center px-2.5' : 'gap-3 px-3'
          } ${
            isActive
              ? 'border-emerald-200 bg-emerald-50 font-semibold text-[#0F5132]'
              : 'border-transparent font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950'
          }`}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {isCollapsed ? (
            <>
              <span className="sr-only">{item.label}</span>
              <span
                aria-hidden="true"
                data-testid={`sidebar-tooltip-${item.id}`}
                className="pointer-events-none absolute top-1/2 left-full z-40 ml-2.5 -translate-y-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {item.label}
              </span>
            </>
          ) : (
            <span className="truncate">{item.label}</span>
          )}
        </a>
      );
    });
  }

  return (
    <aside
      aria-label="Workspace sidebar"
      data-testid="desktop-sidebar"
      data-collapsed={isCollapsed ? 'true' : 'false'}
      className={`hidden shrink-0 border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col ${
        isCollapsed ? 'lg:w-[76px]' : 'lg:w-64'
      }`}
    >
      <div
        className={`flex h-14 items-center border-b border-slate-200 ${
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}
      >
        {!isCollapsed ? (
          <a
            href={buildWorkspaceUrl('overview')}
            onClick={(e) => handleNavClick(e, 'overview')}
            className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
          >
            <Shield className="h-5 w-5 shrink-0 text-[#0F5132]" aria-hidden="true" />
            <span className="font-display truncate text-base font-bold tracking-tight text-slate-950">
              VAYORA
            </span>
          </a>
        ) : null}

        <button
          type="button"
          data-testid="sidebar-collapse-toggle"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapse}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      <nav aria-label="Primary navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">{renderNavItems(workspaceItems)}</div>
        <div role="separator" className="my-3 border-t border-slate-200" />
        <div className="space-y-1">{renderNavItems(accountItems)}</div>
      </nav>

      <div className="border-t border-slate-200 p-3">
        {!isCollapsed ? (
          <div className="mb-2.5 px-2">
            <p className="truncate text-xs font-semibold text-slate-950">{user.displayName}</p>
            <p className="truncate text-xs text-slate-600">{user.email}</p>
          </div>
        ) : null}

        <button
          type="button"
          aria-label="Sign out"
          title={isCollapsed ? 'Sign out' : undefined}
          onClick={() => void onSignOut()}
          className={`group relative flex min-h-11 w-full items-center rounded-lg border border-slate-300 bg-white text-sm font-semibold whitespace-nowrap text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132] ${
            isCollapsed ? 'justify-center px-2.5' : 'gap-2.5 px-3'
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          {isCollapsed ? (
            <>
              <span className="sr-only">Sign out</span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-full z-40 ml-2.5 -translate-y-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                Sign out
              </span>
            </>
          ) : (
            <span>Sign out</span>
          )}
        </button>
      </div>
    </aside>
  );
}
