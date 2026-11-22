import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App.tsx';
import { ErrorBoundary } from '../../src/app/ErrorBoundary.tsx';
import {
  AlertBanner,
  Button,
  FormField,
  PasswordInput,
  PasswordStrengthMeter,
  SkipLink,
} from '../../src/components/index.ts';
import type { AuthService } from '../../src/lib/authService.ts';

function createIdleAuthService(): AuthService {
  return {
    subscribeAuthState: (cb) => {
      cb(null);
      return () => {};
    },
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(async () => {}),
    resendVerificationEmail: vi.fn(async () => {}),
    refreshCurrentUser: vi.fn(async () => null),
    getFreshIdToken: vi.fn(async () => null),
    sendPasswordReset: vi.fn(async () => {}),
    verifyResetCode: vi.fn(async () => {}),
    confirmReset: vi.fn(async () => {}),
    applyEmailVerificationCode: vi.fn(async () => {}),
  };
}

afterEach(() => {
  cleanup();
});

describe('@uaqa/web UI primitives and accessibility', () => {
  it('renders accessible Button with 44px touch target and busy state', () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Save Profile
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save Profile' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.className).toContain('min-h-11');
  });

  it('renders AlertBanner with explicit text severity label and proper ARIA role', () => {
    render(
      <AlertBanner tone="error" title="Authentication Required">
        Please verify your email address before continuing.
      </AlertBanner>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Error: Authentication Required');
  });

  it('renders FormField with accessible label, hint, and invalid error wiring', () => {
    render(
      <FormField
        id="city-input"
        label="City"
        hint="Enter your municipality"
        error="City is required."
        required
      />,
    );

    const input = screen.getByLabelText(/City/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'city-input-hint city-input-error');
  });

  it('toggles PasswordInput visibility with accessible aria-pressed state', () => {
    render(<PasswordInput id="pw-field" label="Password" value="Secret123!" onChange={() => {}} />);

    const input = screen.getByLabelText('Password') as HTMLInputElement;
    const toggle = screen.getByRole('button', { name: 'Show Password' });

    expect(input.type).toBe('password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);
    expect(input.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide Password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('updates PasswordStrengthMeter progress semantics and criteria text', () => {
    render(<PasswordStrengthMeter password="StrongPass2026!" />);

    const meter = screen.getByRole('progressbar', { name: 'Password strength' });
    expect(meter).toHaveAttribute('aria-valuetext', 'Very strong');
  });

  it('renders SkipLink targeting #main-content', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('catches rendering failures inside ErrorBoundary with retry control', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function BrokenChild(): never {
      throw new Error('Simulated render failure');
    }

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Simulated render failure');
    expect(screen.getByRole('button', { name: 'Retry View' })).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('passes automated axe-core WCAG 2.2 AA audit on Phase 1 Login shell', async () => {
    const { container } = render(<App authService={createIdleAuthService()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Sign in to Urban Air Quality Assistant/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');

    const results = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    });

    expect(results.violations).toEqual([]);
  });
});
