import { forgotPasswordInputSchema } from '@uaqa/contracts';
import { useState, type FormEvent } from 'react';
import { AlertBanner, Button, FormField, SurfaceCard } from '../../components/index.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import type { AuthService } from '../../lib/authService.ts';
import { extractZodFieldErrors } from './validationHelpers.ts';

export interface ForgotPasswordFormProps {
  readonly authService: AuthService;
  readonly apiClient: WebApiClient;
  readonly onNavigateLogin: () => void;
}

const GENERIC_RESET_CONFIRMATION =
  'If an account exists for that email address, password reset instructions have been sent.';

export function ForgotPasswordForm({
  authService,
  apiClient,
  onNavigateLogin,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    setSubmittedMessage(null);

    const parsed = forgotPasswordInputSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors(extractZodFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await Promise.all([
        apiClient.requestPasswordResetAudit(parsed.data.email),
        authService.sendPasswordReset(parsed.data.email),
      ]);
      setSubmittedMessage(GENERIC_RESET_CONFIRMATION);
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to process password recovery right now. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SurfaceCard
      as="section"
      aria-labelledby="forgot-password-heading"
      className="mx-auto max-w-lg"
    >
      <div className="space-y-2">
        <p className="font-mono text-xs font-medium tracking-wide text-slate-600 uppercase">
          Password Recovery
        </p>
        <h1
          id="forgot-password-heading"
          className="text-2xl font-bold tracking-tight text-slate-950"
        >
          Reset your password
        </h1>
        <p className="text-sm leading-relaxed text-slate-700">
          Enter the email address associated with your household account to receive a secure
          password reset link.
        </p>
      </div>

      {submittedMessage ? (
        <div className="mt-5">
          <AlertBanner tone="success" title="Reset request processed">
            <p>{submittedMessage}</p>
          </AlertBanner>
        </div>
      ) : null}

      {errorMsg ? (
        <div className="mt-5">
          <AlertBanner tone="error" title="Request could not be completed">
            <p>{errorMsg}</p>
          </AlertBanner>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <FormField
          id="forgot-email"
          label="Email address"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          placeholder="family@household.org"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onNavigateLogin}
            className="min-h-11 rounded-md px-2 text-sm font-medium text-[#0F5132] underline-offset-4 hover:underline"
          >
            Back to sign in
          </button>

          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {isSubmitting ? 'Sending instructions...' : 'Send reset instructions'}
          </Button>
        </div>
      </form>
    </SurfaceCard>
  );
}
