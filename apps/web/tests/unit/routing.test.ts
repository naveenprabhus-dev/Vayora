import { describe, expect, it, vi } from 'vitest';
import {
  buildPublicUrl,
  buildWorkspaceUrl,
  parseWorkspacePageFromLocation,
  readInitialUrlState,
} from '../../src/app/routing.ts';
import { WORKSPACE_NAV_ITEMS, isWorkspacePageId } from '../../src/features/navigation/navConfig.ts';
import type { WebApiClient } from '../../src/lib/apiClient.ts';
import { createCachedWorkspaceApiClient } from '../../src/lib/workspaceApiCache.ts';

describe('Phase 2 Routing & Workspace API Cache (Unit)', () => {
  it('validates all 7 canonical workspace navigation IDs and parses clean nested paths', () => {
    expect(WORKSPACE_NAV_ITEMS.map((item) => item.id)).toEqual([
      'overview',
      'air-quality',
      'daily-routines',
      'indoor-air',
      'sustainable-alternatives',
      'household',
      'settings',
    ]);
    expect(isWorkspacePageId('overview')).toBe(true);
    expect(isWorkspacePageId('sustainable-alternatives')).toBe(true);
    expect(isWorkspacePageId('non-existent')).toBe(false);

    expect(parseWorkspacePageFromLocation({ pathname: '/air-quality/', search: '' })).toBe(
      'air-quality',
    );
    expect(parseWorkspacePageFromLocation({ pathname: '/household', search: '' })).toBe(
      'household',
    );
    expect(
      parseWorkspacePageFromLocation({
        pathname: '/apps/web/tests/e2e/dashboard-harness.html',
        search: '?page=settings',
      }),
    ).toBe('settings');
  });

  it('blocks unauthenticated access to nested workspace URLs while preserving intended destination', () => {
    const blocked = readInitialUrlState({ pathname: '/sustainable-alternatives', search: '' });
    expect(blocked).toEqual({
      route: 'login',
      workspacePage: 'sustainable-alternatives',
      intendedWorkspacePage: 'sustainable-alternatives',
      oobCode: null,
      blockedProtectedRoute: true,
    });

    const reset = readInitialUrlState({ pathname: '/', search: '?mode=resetPassword&oobCode=abc' });
    expect(reset.route).toBe('reset-password');
    expect(reset.oobCode).toBe('abc');
  });

  it('builds clean paths for production URLs and preserves ?page= query params inside HTML test harnesses', () => {
    expect(buildWorkspaceUrl('indoor-air', { pathname: '/overview', search: '' })).toBe(
      '/indoor-air',
    );
    expect(
      buildWorkspaceUrl('indoor-air', {
        pathname: '/apps/web/tests/e2e/dashboard-harness.html',
        search: '?page=overview',
      }),
    ).toBe('/apps/web/tests/e2e/dashboard-harness.html?page=indoor-air');
    expect(buildPublicUrl('login', { pathname: '/settings', search: '' })).toBe('/');
    expect(buildPublicUrl('register', { pathname: '/', search: '' })).toBe('/register');
  });

  it('deduplicates and caches shared AQ/Routines/Briefing requests and invalidates on location update', async () => {
    const baseClient = {
      getAirQualityCurrent: vi.fn(async () => ({ ok: true })),
      getDailyRoutines: vi.fn(async () => ({ ok: true })),
      getIndoorAirGuidance: vi.fn(async () => ({ ok: true })),
      getSustainableAlternatives: vi.fn(async () => ({ ok: true })),
      getPersonalizedBriefing: vi.fn(async () => ({ ok: true })),
      updateAirQualityLocation: vi.fn(async () => ({ ok: true })),
      saveHouseholdProfile: vi.fn(async () => ({ ok: true })),
    } as unknown as WebApiClient;

    const cached = createCachedWorkspaceApiClient(baseClient);

    await Promise.all([
      cached.getAirQualityCurrent({ hours: 24 }),
      cached.getAirQualityCurrent({ hours: 24 }),
    ]);
    expect(baseClient.getAirQualityCurrent).toHaveBeenCalledTimes(1);

    await cached.getAirQualityCurrent({ hours: 24 });
    expect(baseClient.getAirQualityCurrent).toHaveBeenCalledTimes(1);

    await cached.updateAirQualityLocation({
      country: 'Poland',
      city: 'Gdansk',
      neighborhood: 'Wrzeszcz',
      postalPrefix: '80-2',
    });

    await cached.getAirQualityCurrent({ hours: 24 });
    expect(baseClient.getAirQualityCurrent).toHaveBeenCalledTimes(2);
  });
});
