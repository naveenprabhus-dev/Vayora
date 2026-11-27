import {
  CalendarClock,
  Home,
  LayoutDashboard,
  Leaf,
  Settings,
  Users,
  Wind,
  type LucideIcon,
} from 'lucide-react';

export type WorkspacePageId =
  | 'overview'
  | 'air-quality'
  | 'daily-routines'
  | 'indoor-air'
  | 'sustainable-alternatives'
  | 'household'
  | 'settings';

export interface WorkspaceNavItem {
  readonly id: WorkspacePageId;
  readonly path: `/${WorkspacePageId}`;
  readonly label: string;
  readonly pageTitle: string;
  readonly documentTitle: string;
  readonly shortDescription: string;
  readonly group: 'workspace' | 'account';
  readonly Icon: LucideIcon;
}

export const WORKSPACE_NAV_ITEMS: readonly WorkspaceNavItem[] = [
  {
    id: 'overview',
    path: '/overview',
    label: 'Overview',
    pageTitle: 'Air Quality Overview',
    documentTitle: 'Overview · VAYORA',
    shortDescription: 'Current AQI, short briefing, top actions, and next routine.',
    group: 'workspace',
    Icon: LayoutDashboard,
  },
  {
    id: 'air-quality',
    path: '/air-quality',
    label: 'Air Quality',
    pageTitle: 'Air Quality Intelligence',
    documentTitle: 'Air Quality · VAYORA',
    shortDescription: 'US EPA & EEA AQI scales, 6 pollutants, hourly forecast, and transparency.',
    group: 'workspace',
    Icon: Wind,
  },
  {
    id: 'daily-routines',
    path: '/daily-routines',
    label: 'Daily Routines',
    pageTitle: 'Low-Emission Daily Routines',
    documentTitle: 'Daily Routines · VAYORA',
    shortDescription: 'Time windows, commute strategy, and exposure vs. emissions guidance.',
    group: 'workspace',
    Icon: CalendarClock,
  },
  {
    id: 'indoor-air',
    path: '/indoor-air',
    label: 'Indoor Air',
    pageTitle: 'Indoor Air Quality Assistant',
    documentTitle: 'Indoor Air · VAYORA',
    shortDescription: 'Ventilation timing, HEPA limits, scenario simulations, and source guides.',
    group: 'workspace',
    Icon: Home,
  },
  {
    id: 'sustainable-alternatives',
    path: '/sustainable-alternatives',
    label: 'Sustainable Alternatives',
    pageTitle: 'Sustainable Alternatives',
    documentTitle: 'Sustainable Alternatives · VAYORA',
    shortDescription: 'Practical transport, heating, daily habit, and waste comparisons.',
    group: 'workspace',
    Icon: Leaf,
  },
  {
    id: 'household',
    path: '/household',
    label: 'My Household',
    pageTitle: 'My Household',
    documentTitle: 'My Household · VAYORA',
    shortDescription: 'Verified location zone, household composition, and indoor setup.',
    group: 'account',
    Icon: Users,
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    pageTitle: 'Settings',
    documentTitle: 'Settings · VAYORA',
    shortDescription: 'Account verification, guidance focus, smog alerts, and session security.',
    group: 'account',
    Icon: Settings,
  },
] as const;

const NAV_BY_ID: ReadonlyMap<WorkspacePageId, WorkspaceNavItem> = new Map(
  WORKSPACE_NAV_ITEMS.map((item) => [item.id, item]),
);

const NAV_BY_PATH: ReadonlyMap<string, WorkspaceNavItem> = new Map(
  WORKSPACE_NAV_ITEMS.map((item) => [item.path, item]),
);

export function isWorkspacePageId(value: string | null | undefined): value is WorkspacePageId {
  return value !== null && value !== undefined && NAV_BY_ID.has(value as WorkspacePageId);
}

export function getWorkspaceNavItem(pageId: WorkspacePageId): WorkspaceNavItem {
  const item = NAV_BY_ID.get(pageId);
  if (!item) {
    throw new Error(`Unknown workspace page ID: ${pageId}`);
  }
  return item;
}

export function resolveWorkspacePageFromPath(pathname: string): WorkspacePageId | null {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return NAV_BY_PATH.get(normalized)?.id ?? null;
}
