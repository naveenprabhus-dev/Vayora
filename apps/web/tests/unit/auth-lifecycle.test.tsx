import type { HouseholdLifestyleInput, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App.tsx';
import { ApiClientError, type WebApiClient } from '../../src/lib/apiClient.ts';
import type { AuthService, AuthUserSnapshot } from '../../src/lib/authService.ts';
import type { HouseholdStore } from '../../src/lib/householdStore.ts';

const MOCK_PROFILE: HouseholdLifestyleRecord = {
  ownerUid: 'uid_verified_family',
  country: 'Poland',
  city: 'Krakow',
  neighborhood: 'Krowodrza',
  postalPrefix: '30-01',
  locationPreferences: {
    primaryZoneType: 'urban_core',
    alertsEnabled: true,
  },
  householdSize: 2,
  householdComposition: ['adults'],
  primaryCommuteMode: 'public_transit',
  outdoorActivityPattern: 'morning_commute',
  ventilationContext: 'natural_windows',
  hasIndoorAirPurifier: false,
  heatingType: 'district',
  lifestylePreferences: {
    preferredGuidanceFocus: 'balanced',
    reminderCadence: 'daily_smog_alerts',
  },
  onboardingCompleted: true,
};

function createLifecycleHarness(options?: {
  initialUser?: AuthUserSnapshot | null;
  initialProfile?: HouseholdLifestyleRecord | null;
}) {
  let currentUser: AuthUserSnapshot | null = options?.initialUser ?? null;
  let storedProfile: HouseholdLifestyleRecord | null = options?.initialProfile ?? null;
  const subscribers = new Set<(user: AuthUserSnapshot | null) => void>();

  const subscribeAuthState = vi.fn((onChange: (user: AuthUserSnapshot | null) => void) => {
    subscribers.add(onChange);
    onChange(currentUser);
    return () => {
      subscribers.delete(onChange);
    };
  });

  const authService: AuthService = {
    subscribeAuthState,
    register: vi.fn(async (input) => {
      currentUser = {
        uid: 'uid_new_family',
        email: input.email,
        displayName: input.displayName,
        emailVerified: false,
      };
      return currentUser;
    }),
    login: vi.fn(async (input) => {
      currentUser = {
        uid: 'uid_verified_family',
        email: input.email,
        displayName: 'Elena Nowak',
        emailVerified: true,
      };
      for (const cb of subscribers) {
        cb(currentUser);
      }
      return currentUser;
    }),
    logout: vi.fn(async () => {
      currentUser = null;
      for (const cb of subscribers) {
        cb(null);
      }
    }),
    resendVerificationEmail: vi.fn(async () => undefined),
    refreshCurrentUser: vi.fn(async () => {
      if (currentUser) {
        currentUser = { ...currentUser, emailVerified: true };
      }
      return currentUser;
    }),
    getFreshIdToken: vi.fn(async () => (currentUser ? 'valid-firebase-token' : null)),
    sendPasswordReset: vi.fn(async () => undefined),
    verifyResetCode: vi.fn(async () => undefined),
    confirmReset: vi.fn(async () => undefined),
    applyEmailVerificationCode: vi.fn(async () => undefined),
  };

  const syncVerifiedUserAccount = vi.fn<HouseholdStore['syncVerifiedUserAccount']>(
    async () => undefined,
  );
  const householdStore: HouseholdStore = {
    syncVerifiedUserAccount,
    getHouseholdProfile: vi.fn(async () => storedProfile),
    saveHouseholdProfile: vi.fn(async (uid: string, input: HouseholdLifestyleInput) => {
      storedProfile = { ownerUid: uid, ...input };
      return storedProfile;
    }),
  };

  const apiClient = {
    getHealth: vi.fn(async () => ({
      status: 'ok' as const,
      service: 'urban-air-quality-api' as const,
      version: '0.1.0',
      environment: 'test',
      uptimeSeconds: 1,
    })),
    getAuthSession: vi.fn(async () => ({
      authenticated: true as const,
      principal: {
        uid: currentUser?.uid ?? 'uid_verified_family',
        email: currentUser?.email ?? 'elena@household.org',
        emailVerified: currentUser?.emailVerified ?? true,
        role: 'regular_user' as const,
        authTimeSeconds: 1700000100,
      },
    })),
    verifyToken: vi.fn(),
    requestPasswordResetAudit: vi.fn(),
    getHouseholdProfile: vi.fn(async () => {
      if (!storedProfile) {
        throw new ApiClientError({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Not found',
          requestId: 'req-404',
        });
      }
      return { profile: storedProfile };
    }),
    saveHouseholdProfile: vi.fn(async (input: HouseholdLifestyleInput) => {
      storedProfile = { ownerUid: currentUser?.uid ?? 'uid_verified_family', ...input };
      return { profile: storedProfile };
    }),
    validateHouseholdProfile: vi.fn(),
    getAirQualityCurrent: vi.fn(async () => {
      throw new ApiClientError({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Unavailable in lifecycle test',
        requestId: 'req-aq',
      });
    }),
    getAirQualityForecast: vi.fn(),
    getAirQualityPollutants: vi.fn(),
    getAirQualityGuidance: vi.fn(),
    getAirQualityHealth: vi.fn(),
    updateAirQualityLocation: vi.fn(),
    getDailyRoutines: vi.fn(async () => {
      throw new ApiClientError({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Unavailable in lifecycle test',
        requestId: 'req-routines',
      });
    }),
    refreshDailyRoutines: vi.fn(),
    getIndoorAirGuidance: vi.fn(),
    refreshIndoorAirGuidance: vi.fn(),
    getSustainableAlternatives: vi.fn(),
    compareSustainableAlternative: vi.fn(),
    refreshSustainableAlternatives: vi.fn(),
    getPersonalizedBriefing: vi.fn(async () => {
      throw new ApiClientError({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Unavailable in lifecycle test',
        requestId: 'req-advisory',
      });
    }),
    explainRecommendation: vi.fn(),
    compareChoicesExplanation: vi.fn(),
    refreshPersonalizedAdvisory: vi.fn(),
    getAdvisoryMetrics: vi.fn(),
  } as unknown as WebApiClient;

  return {
    authService,
    householdStore,
    apiClient,
    subscribeAuthState,
    syncVerifiedUserAccount,
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

describe('Authentication subscription lifecycle & terms acceptance (Wave 4B Phase 3)', () => {
  it('subscribes to auth state once without recreating subscription on registration, verification, terms sync, or logout', async () => {
    const harness = createLifecycleHarness();

    render(
      <App
        authService={harness.authService}
        householdStore={harness.householdStore}
        apiClient={harness.apiClient}
      />,
    );

    expect(harness.subscribeAuthState).toHaveBeenCalledTimes(1);

    fireEvent.click(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Create account' }),
    );
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Elena Nowak' } });
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'elena@household.org' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/, { selector: 'input' }), {
      target: { value: 'WinterCleanAir2026!' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm password/, { selector: 'input' }), {
      target: { value: 'WinterCleanAir2026!' },
    });
    fireEvent.click(screen.getByLabelText(/Terms of Use/));
    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', { name: 'Create account' }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: /Verify your email address/i }),
    ).toBeInTheDocument();

    // Crucial regression: setting pendingTermsIso after registration must NOT re-subscribe auth state.
    expect(harness.subscribeAuthState).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /I've verified my email/i }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Set up your household air-quality profile/i,
      }),
    ).toBeInTheDocument();

    expect(harness.syncVerifiedUserAccount).toHaveBeenCalledTimes(1);
    const termsIsoArg = harness.syncVerifiedUserAccount.mock.calls[0]?.[1];
    expect(typeof termsIsoArg).toBe('string');
    expect(Number.isNaN(Date.parse(String(termsIsoArg)))).toBe(false);
    expect(harness.subscribeAuthState).toHaveBeenCalledTimes(1);

    // Sign out clears pendingTermsIsoRef so a subsequent login does not reuse stale registration terms timestamp.
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: /Sign out/i }));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Sign in to Urban Air Quality Assistant/i,
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'elena@household.org' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/, { selector: 'input' }), {
      target: { value: 'WinterCleanAir2026!' },
    });
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(harness.syncVerifiedUserAccount).toHaveBeenCalledTimes(2);
    });
    expect(harness.syncVerifiedUserAccount.mock.calls[1]?.[1]).toBeUndefined();
    expect(harness.subscribeAuthState).toHaveBeenCalledTimes(1);
  });

  it('restores a verified session cleanly with a single auth subscription and without test/connection probes', async () => {
    const harness = createLifecycleHarness({
      initialUser: {
        uid: 'uid_verified_family',
        email: 'elena@household.org',
        displayName: 'Elena Nowak',
        emailVerified: true,
      },
      initialProfile: MOCK_PROFILE,
    });

    render(
      <App
        authService={harness.authService}
        householdStore={harness.householdStore}
        apiClient={harness.apiClient}
      />,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: /Air Quality Overview/i }),
    ).toBeInTheDocument();
    expect(harness.subscribeAuthState).toHaveBeenCalledTimes(1);
    expect(harness.syncVerifiedUserAccount).toHaveBeenCalledTimes(1);
  });
});
