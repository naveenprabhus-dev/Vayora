import { MailCheck, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import {
  AuthServiceError,
  type AuthService,
  type AuthUserSnapshot,
} from '../../lib/authService.ts';

export interface VerifyEmailScreenProps {
  readonly user: AuthUserSnapshot;
  readonly authService: AuthService;
  readonly apiClient: WebApiClient;
  readonly initialOobCode?: string | null | undefined;
  readonly onVerified: (user: AuthUserSnapshot) => Promise<void>;
  readonly onSignOut: () => Promise<void>;
}

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailScreen({
  user,
  authService,
  apiClient,
  initialOobCode,
  onVerified,
  onSignOut,
}: VerifyEmailScreenProps) {
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!initialOobCode) {
      return;
    }
    let active = true;
    void (async () => {
      setIsChecking(true);
      setErrorMsg(null);
      try {
        await authService.applyEmailVerificationCode(initialOobCode);
        const refreshed = await authService.refreshCurrentUser();
        if (!active || !refreshed) {
          return;
        }
        if (refreshed.emailVerified) {
          await authService.getFreshIdToken(true);
          const session = await apiClient.getAuthSession();
          if (session.principal.emailVerified) {
            await onVerified(refreshed);
            return;
          }
        }
        setStatusNotice('Verification link applied. Confirm your session status below.');
      } catch (error) {
        if (!active) {
          return;
        }
        setErrorMsg(
          error instanceof Error
            ? error.message
            : 'This verification link is invalid or expired. Request a new email below.',
        );
      } finally {
        if (active) {
          setIsChecking(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [apiClient, authService, initialOobCode, onVerified]);

  async function handleCheckVerification() {
    setErrorMsg(null);
    setStatusNotice(null);
    setIsChecking(true);
    try {
      const refreshed = await authService.refreshCurrentUser();
      if (!refreshed || !refreshed.emailVerified) {
        setStatusNotice(
          'Your email is not verified yet. Open the verification link in your inbox, then check again.',
        );
        return;
      }

      // Force token refresh so Firebase ID token carries updated email_verified: true claim
      await authService.getFreshIdToken(true);

      // Never trust client state alone: confirm with Express backend token verifier
      const session = await apiClient.getAuthSession();
      if (!session.principal.emailVerified) {
        setErrorMsg(
          'Server verification check did not confirm your email claim yet. Retry shortly.',
        );
        return;
      }

      await onVerified(refreshed);
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setErrorMsg(error.message);
      } else if (error instanceof Error) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Unable to verify your email status with the server.');
      }
    } finally {
      setIsChecking(false);
    }
  }

  async function handleResend() {
    setErrorMsg(null);
    setStatusNotice(null);
    setIsResending(true);
    try {
      await authService.resendVerificationEmail();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStatusNotice(`A fresh verification email was sent to ${user.email}.`);
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to resend verification email. Please wait and try again.',
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <SurfaceCard as="section" aria-labelledby="verify-email-heading" className="mx-auto max-w-lg">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[#0F5132]">
          <MailCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="font-mono text-xs font-medium tracking-wide text-slate-600 uppercase">
            Step 2 · Email Verification Gate
          </p>
          <h1
            id="verify-email-heading"
            className="text-2xl font-bold tracking-tight text-slate-950"
          >
            Verify your email address
          </h1>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-700">
        We sent a verification link to{' '}
        <span className="font-mono font-semibold text-slate-950">{user.email}</span>. Both Firestore
        security rules and our backend API block application access until your email is confirmed.
      </p>

      {statusNotice ? (
        <div className="mt-5">
          <AlertBanner tone="info" title="Verification status">
            <p>{statusNotice}</p>
          </AlertBanner>
        </div>
      ) : null}

      {errorMsg ? (
        <div className="mt-5">
          <AlertBanner tone="error" title="Verification check failed">
            <p>{errorMsg}</p>
          </AlertBanner>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          isLoading={isChecking}
          onClick={handleCheckVerification}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {isChecking ? 'Verifying with server...' : "I've verified my email"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={cooldown > 0}
          isLoading={isResending}
          onClick={handleResend}
        >
          {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
        </Button>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="min-h-11 rounded-md px-2 text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
        >
          Sign out and use a different email
        </button>
      </div>
    </SurfaceCard>
  );
}
