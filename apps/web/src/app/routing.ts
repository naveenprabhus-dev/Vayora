import {
  getWorkspaceNavItem,
  isWorkspacePageId,
  resolveWorkspacePageFromPath,
  type WorkspacePageId,
} from '../features/navigation/navConfig.ts';

export type AppRoute =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-password'
  | 'verify-email'
  | 'onboarding'
  | 'workspace';

export interface InitialUrlState {
  readonly route: AppRoute;
  readonly workspacePage: WorkspacePageId;
  readonly intendedWorkspacePage: WorkspacePageId | null;
  readonly oobCode: string | null;
  readonly blockedProtectedRoute: boolean;
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname || '/';
}

export function isHarnessDocumentPath(pathname: string): boolean {
  return pathname.endsWith('.html');
}

export function parseWorkspacePageFromLocation(
  loc: Pick<Location, 'pathname' | 'search'> | undefined = typeof window !== 'undefined'
    ? window.location
    : undefined,
): WorkspacePageId | null {
  if (!loc) {
    return null;
  }
  const params = new URLSearchParams(loc.search);
  const queryPage = params.get('page');
  if (isWorkspacePageId(queryPage)) {
    return queryPage;
  }

  const fromPath = resolveWorkspacePageFromPath(loc.pathname);
  if (fromPath) {
    return fromPath;
  }

  const normalized = normalizePathname(loc.pathname);
  if (normalized === '/' || isHarnessDocumentPath(normalized)) {
    const view = params.get('view');
    if (view === 'dashboard' || view === 'account-ready') {
      return 'overview';
    }
    return isHarnessDocumentPath(normalized) ? 'overview' : null;
  }

  return null;
}

export function readInitialUrlState(
  loc: Pick<Location, 'pathname' | 'search'> | undefined = typeof window !== 'undefined'
    ? window.location
    : undefined,
): InitialUrlState {
  if (!loc) {
    return {
      route: 'login',
      workspacePage: 'overview',
      intendedWorkspacePage: null,
      oobCode: null,
      blockedProtectedRoute: false,
    };
  }

  const params = new URLSearchParams(loc.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  const view = params.get('view');
  const pathname = normalizePathname(loc.pathname);

  if (mode === 'resetPassword') {
    return {
      route: 'reset-password',
      workspacePage: 'overview',
      intendedWorkspacePage: null,
      oobCode: oobCode ?? '',
      blockedProtectedRoute: false,
    };
  }
  if (mode === 'verifyEmail' && oobCode) {
    return {
      route: 'verify-email',
      workspacePage: 'overview',
      intendedWorkspacePage: null,
      oobCode,
      blockedProtectedRoute: false,
    };
  }
  if (view === 'register' || pathname === '/register') {
    return {
      route: 'register',
      workspacePage: 'overview',
      intendedWorkspacePage: null,
      oobCode: null,
      blockedProtectedRoute: false,
    };
  }
  if (view === 'forgot-password' || pathname === '/forgot-password') {
    return {
      route: 'forgot-password',
      workspacePage: 'overview',
      intendedWorkspacePage: null,
      oobCode: null,
      blockedProtectedRoute: false,
    };
  }

  const requestedWorkspacePage = resolveWorkspacePageFromPath(pathname);
  const queryPage = params.get('page');
  const effectiveQueryPage = isWorkspacePageId(queryPage) ? queryPage : null;
  const targetWorkspacePage = requestedWorkspacePage ?? effectiveQueryPage;

  if (
    targetWorkspacePage !== null ||
    view === 'onboarding' ||
    view === 'account-ready' ||
    view === 'dashboard' ||
    pathname === '/onboarding'
  ) {
    return {
      route: 'login',
      workspacePage: targetWorkspacePage ?? 'overview',
      intendedWorkspacePage: targetWorkspacePage,
      oobCode: null,
      blockedProtectedRoute: true,
    };
  }

  return {
    route: 'login',
    workspacePage: 'overview',
    intendedWorkspacePage: null,
    oobCode: null,
    blockedProtectedRoute: false,
  };
}

export function buildWorkspaceUrl(
  pageId: WorkspacePageId,
  loc: Pick<Location, 'pathname' | 'search'> | undefined = typeof window !== 'undefined'
    ? window.location
    : undefined,
): string {
  const navItem = getWorkspaceNavItem(pageId);
  if (loc && isHarnessDocumentPath(loc.pathname)) {
    const params = new URLSearchParams(loc.search);
    params.set('page', pageId);
    return `${loc.pathname}?${params.toString()}`;
  }
  return navItem.path;
}

export function buildPublicUrl(
  route: 'login' | 'register' | 'forgot-password' | 'onboarding',
  loc: Pick<Location, 'pathname' | 'search'> | undefined = typeof window !== 'undefined'
    ? window.location
    : undefined,
): string {
  if (loc && isHarnessDocumentPath(loc.pathname)) {
    return loc.pathname;
  }
  if (route === 'login') {
    return '/';
  }
  if (route === 'onboarding') {
    return '/onboarding';
  }
  return `/${route}`;
}
