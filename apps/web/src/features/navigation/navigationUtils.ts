import type { MouseEvent } from 'react';
import { WORKSPACE_NAV_ITEMS, type WorkspacePageId } from './navConfig.ts';

export const WORKSPACE_GROUP_ITEMS = WORKSPACE_NAV_ITEMS.filter(
  (item) => item.group === 'workspace',
);

export const ACCOUNT_GROUP_ITEMS = WORKSPACE_NAV_ITEMS.filter((item) => item.group === 'account');

export function handleWorkspaceLinkClick(
  event: MouseEvent<HTMLAnchorElement>,
  pageId: WorkspacePageId,
  onNavigate: (pageId: WorkspacePageId) => void,
  onBeforeNavigate?: () => void,
): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return;
  }
  event.preventDefault();
  onBeforeNavigate?.();
  onNavigate(pageId);
}
