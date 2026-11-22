import type { HouseholdLifestyleInput, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App.tsx';
import { ApiClientError, type WebApiClient } from '../../src/lib/apiClient.ts';
import {
  AuthServiceError,
  type AuthService,
  type AuthUserSnapshot,
} from '../../src/lib/authService.ts';
import type { HouseholdStore } from '../../src/lib/householdStore.ts';

async function runAxeAudit(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    },
  });
  expect(results.violations).toEqual([]);
}

function createHarness(options?: {
  initialUser?: AuthUserSnapshot | null;
  initialProfile?: HouseholdLifestyleRecord | null;
}) {
  let currentUser: AuthUserSnapshot | null = options?.initialUser ?? null;
  let storedProfile: HouseholdLifestyleRecord | null = options?.initialProfile ?? null;
  let subscriber: ((user: AuthUserSnapshot | null) => void) | null = null;

  const authService: AuthService = {
    subscribeAuthState(onChange) {
      subscriber = onChange;
      onChange(currentUser);
      return () => {
        subscriber = null;
      };
    },
    async register(input) {
      if (input.email === 'duplicate@household.org') {
        throw new AuthServiceError(
          'auth/email-already-in-use',
          'An account with this email address already exists. Sign in or recover your password.',
        );
      }
      currentUser = {
        uid: 'uid_new_family',
        email: input.email,
        displayName: input.displayName,
        emailVerified: false,
      };
      return currentUser;
    },
    async login(input) {
      if (input.password === 'WrongPassword1!') {
        throw new AuthServiceError('auth/invalid-credential', 'Invalid email address or password.');
      }
      currentUser = {
        uid: 'uid_verified_family',
        email: input.email,
        displayName: 'Elena Nowak',
        emailVerified: true,
      };
      subscriber?.(currentUser);
      return currentUser;
    },
    async logout() {
      currentUser = null;
      subscriber?.(null);
    },
    resendVerificationEmail: vi.fn(async () => {}),
    async refreshCurrentUser() {
      if (currentUser) {
        currentUser = { ...currentUser, emailVerified: true };
      }
      return currentUser;
    },
    async getFreshIdToken() {
      return currentUser ? 'valid-firebase-id-token' : null;
    },
    sendPasswordReset: vi.fn(async () => {}),
    verifyResetCode: vi.fn(async (oobCode: string) => {
      if (oobCode === 'expired-code-999') {
        throw new AuthServiceError(
          'auth/expired-action-code',
          'This link has expired. Request a new verification or password reset email.',
        );
      }
    }),
    confirmReset: vi.fn(async () => {}),
    applyEmailVerificationCode: vi.fn(async () => {}),
  };

  const householdStore: HouseholdStore = {
    syncVerifiedUserAccount: vi.fn(async () => {}),
    async getHouseholdProfile() {
      return storedProfile;
    },
    async saveHouseholdProfile(uid: string, input: HouseholdLifestyleInput) {
      storedProfile = { ownerUid: uid, ...input };
      return storedProfile;
    },
  };

  const apiClient: WebApiClient = {
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
    verifyToken: vi.fn(async () => ({
      verified: true as const,
      principal: {
        uid: 'uid_verified_family',
        email: 'elena@household.org',
        emailVerified: true,
        role: 'regular_user' as const,
        authTimeSeconds: 1700000100,
      },
    })),
    requestPasswordResetAudit: vi.fn(async () => ({
      accepted: true,
      message:
        'If an account exists for that email address, password reset instructions have been sent.',
    })),
    getHouseholdProfile: vi.fn(async () => {
      if (!storedProfile) {
        throw new ApiClientError({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Household profile has not been completed yet.',
          requestId: 'req-test-404',
        });
      }
      return { profile: storedProfile };
    }),
    saveHouseholdProfile: vi.fn(async (input: HouseholdLifestyleInput) => {
      storedProfile = { ownerUid: currentUser?.uid ?? 'uid_verified_family', ...input };
      return { profile: storedProfile };
    }),
    validateHouseholdProfile: vi.fn(async () => ({
      valid: true as const,
      ownerUid: 'uid_verified_family',
    })),
  };

  return { authService, householdStore, apiClient };
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('Phase 1 Authentication & Household Onboarding Flows', () => {
  it('supports registration validation, duplicate handling, email verification gate, and 3-step onboarding completion', async () => {
    const harness = createHarness();
    const { container } = render(
      <App
        authService={harness.authService}
        householdStore={harness.householdStore}
        apiClient={harness.apiClient}
      />,
    );

    fireEvent.click(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Create account' }),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /Create your household account/i }),
    ).toBeInTheDocument();
    await runAxeAudit(container);

    // Duplicate email handling
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Elena Nowak' } });
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'duplicate@household.org' },
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

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);

    // Successful registration -> Verify Email screen
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'elena@household.org' },
    });
    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', { name: 'Create account' }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: /Verify your email address/i }),
    ).toBeInTheDocument();
    await runAxeAudit(container);

    // Confirm email verification through server session check -> Household Onboarding Step 1
    fireEvent.click(screen.getByRole('button', { name: /I've verified my email/i }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Set up your household air-quality profile/i,
      }),
    ).toBeInTheDocument();
    expect(harness.apiClient.getAuthSession).toHaveBeenCalled();
    expect(harness.householdStore.syncVerifiedUserAccount).toHaveBeenCalled();
    await runAxeAudit(container);

    // Step 1: Location
    fireEvent.change(screen.getByLabelText(/Country/), { target: { value: 'Poland' } });
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Krakow' } });
    fireEvent.change(screen.getByLabelText(/Neighborhood or district/), {
      target: { value: 'Krowodrza' },
    });
    fireEvent.change(screen.getByLabelText(/Postal prefix/), { target: { value: '30-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Step 2' }));

    // Step 2: Household & Routine
    expect(
      await screen.findByRole('heading', { level: 2, name: /Household & Daily Routine/i }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Household size/), { target: { value: '4' } });
    fireEvent.click(screen.getByLabelText(/Young children/));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Step 3' }));

    // Step 3: Indoor Air & Preferences -> Complete Onboarding
    expect(
      await screen.findByRole('heading', { level: 2, name: /Indoor Air & Guidance Preferences/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/HEPA indoor air purifier/));
    fireEvent.click(screen.getByRole('button', { name: 'Complete onboarding' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: /Welcome, Elena Nowak/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Krowodrza, Krakow, Poland/)).toBeInTheDocument();
    await runAxeAudit(container);

    // Edit preferences after completion
    fireEvent.click(screen.getByRole('button', { name: /Edit preferences/i }));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Edit household location & lifestyle preferences/i,
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Warsaw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Step 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Step 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save updated preferences' }));

    expect(await screen.findByText(/Krowodrza, Warsaw, Poland/)).toBeInTheDocument();
  });

  it('provides enumeration-resistant forgot password response and handles expired vs valid reset links', async () => {
    const harness = createHarness();
    const { container } = render(
      <App
        authService={harness.authService}
        householdStore={harness.householdStore}
        apiClient={harness.apiClient}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(
      screen.getByRole('heading', { level: 1, name: /Reset your password/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'unknown@household.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset instructions' }));

    const confirmation = await screen.findByRole('status');
    expect(confirmation).toHaveTextContent(
      'If an account exists for that email address, password reset instructions have been sent.',
    );
    await runAxeAudit(container);
  });

  it('recovers cleanly from expired reset oobCode and accepts valid password reset confirmation', async () => {
    window.history.replaceState({}, '', '/?mode=resetPassword&oobCode=expired-code-999');
    const expiredHarness = createHarness();
    render(
      <App
        authService={expiredHarness.authService}
        householdStore={expiredHarness.householdStore}
        apiClient={expiredHarness.apiClient}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/expired/i);
    expect(screen.getByRole('button', { name: 'Request a new reset link' })).toBeInTheDocument();

    cleanup();
    window.history.replaceState({}, '', '/?mode=resetPassword&oobCode=valid-reset-code-123');
    const validHarness = createHarness();
    render(
      <App
        authService={validHarness.authService}
        householdStore={validHarness.householdStore}
        apiClient={validHarness.apiClient}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/^New password/, { selector: 'input' })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/^New password/), {
      target: { value: 'UpdatedAirPass2026!' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm new password/, { selector: 'input' }), {
      target: { value: 'UpdatedAirPass2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Sign in to Urban Air Quality Assistant/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/password has been updated/i);
  });

  it('handles login errors, protected route URL attempts, and logout cleanly', async () => {
    window.history.replaceState({}, '', '/?view=onboarding');
    const harness = createHarness();
    render(
      <App
        authService={harness.authService}
        householdStore={harness.householdStore}
        apiClient={harness.apiClient}
      />,
    );

    // Protected route attempt redirects to login with notice
    expect(
      screen.getByRole('heading', { level: 1, name: /Sign in to Urban Air Quality Assistant/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /Sign in with a verified household account/i,
    );

    // Invalid login
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'elena@household.org' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/, { selector: 'input' }), {
      target: { value: 'WrongPassword1!' },
    });
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Invalid email address or password/i,
    );

    // Valid login + Save Draft + Resume later
    fireEvent.change(screen.getByLabelText(/^Password/, { selector: 'input' }), {
      target: { value: 'WinterCleanAir2026!' },
    });
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Set up your household air-quality profile/i,
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Country/), { target: { value: 'Poland' } });
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Gdansk' } });
    fireEvent.change(screen.getByLabelText(/Neighborhood or district/), {
      target: { value: 'Wrzeszcz' },
    });
    fireEvent.change(screen.getByLabelText(/Postal prefix/), { target: { value: '80-2' } });
    fireEvent.click(screen.getByRole('button', { name: /Save draft & resume later/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/draft has been saved/i);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Sign in to Urban Air Quality Assistant/i,
      }),
    ).toBeInTheDocument();

    // Sign back in -> resumes onboarding wizard with previously saved draft city prefilled
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'elena@household.org' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/, { selector: 'input' }), {
      target: { value: 'WinterCleanAir2026!' },
    });
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Set up your household air-quality profile/i,
      }),
    ).toBeInTheDocument();
    expect((screen.getByLabelText(/City/) as HTMLInputElement).value).toBe('Gdansk');
  });
});
