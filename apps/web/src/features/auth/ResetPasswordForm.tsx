import { passwordResetConfirmSchema } from '@uaqa/contracts';
import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertBanner,
  Button,
  PasswordInput,
  PasswordStrengthMeter,
  SurfaceCard,
} from '../../components/index.ts';
import type { AuthService } from '../../lib/authService.ts';
import { extractZodFieldErrors } from './validationHelpers.ts';

export interface ResetPasswordFormProps {
  readonly oobCode: string;
  readonly authService: AuthService;
  readonly onResetComplete: () => void;
  readonly onRequestNewLink: () => void;
}

export function ResetPasswordForm({
  oobCode,
  authService,
  onResetComplete,
  onRequestNewLink,
}: ResetPasswordFormProps) {
  const [codeStatus, setCodeStatus] = useState<'checking' | 'valid' | 'invalid'>(() =>
    !oobCode || oobCode.trim().length < 6 ? 'invalid' : 'checking',
  );
  const [codeError, setCodeError] = useState<string | null>(() =>
    !oobCode || oobCode.trim().length < 6
      ? 'This password reset link is missing or malformed.'
      : null,
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!oobCode || oobCode.trim().length < 6) {
      return undefined;
    }
    let active = true;
    async function verifyCode() {
      try {
        await authService.verifyResetCode(oobCode);
        if (active) {
          setCodeStatus('valid');
          setCodeError(null);
        }
      } catch (error: unknown) {
        if (active) {
          setCodeStatus('invalid');
          setCodeError(
            error instanceof Error
              ? error.message
              : 'This password reset link is invalid or has expired.',
          );
        }
      }
    }
    void verifyCode();
    return () => {
      active = false;
    };
  }, [authService, oobCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = passwordResetConfirmSchema.safeParse({
      oobCode,
      newPassword,
      confirmNewPassword,
    });
    if (!parsed.success) {
      setFieldErrors(extractZodFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await authService.confirmReset(parsed.data.oobCode, parsed.data.newPassword);
      onResetComplete();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to update your password. Request a new reset link and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SurfaceCard as="section" aria-labelledby="reset-password-heading" className="mx-auto max-w-lg">
      <div className="space-y-2">
        <p className="font-mono text-xs font-medium tracking-wide text-slate-600 uppercase">
          Password Recovery
        </p>
        <h1
          id="reset-password-heading"
          className="text-2xl font-bold tracking-tight text-slate-950"
        >
          Choose a new password
        </h1>
      </div>

      {codeStatus === 'checking' ? (
        <div className="mt-5">
          <AlertBanner tone="info" title="Validating reset link">
            <p>Checking the validity of your password recovery link...</p>
          </AlertBanner>
        </div>
      ) : null}

      {codeStatus === 'invalid' ? (
        <div className="mt-5 space-y-5">
          <AlertBanner tone="error" title="Reset link unavailable">
            <p>{codeError ?? 'This password reset link is invalid or has expired.'}</p>
          </AlertBanner>
          <Button type="button" variant="primary" onClick={onRequestNewLink}>
            Request a new reset link
          </Button>
        </div>
      ) : null}

      {codeStatus === 'valid' ? (
        <>
          {submitError ? (
            <div className="mt-5">
              <AlertBanner tone="error" title="Password update failed">
                <p>{submitError}</p>
              </AlertBanner>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
            <div className="space-y-3">
              <PasswordInput
                id="reset-new-password"
                label="New password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={fieldErrors.newPassword}
              />
              <PasswordStrengthMeter password={newPassword} />
            </div>

            <PasswordInput
              id="reset-confirm-password"
              label="Confirm new password"
              autoComplete="new-password"
              required
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              error={fieldErrors.confirmNewPassword}
            />

            <div className="flex justify-end pt-1">
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                {isSubmitting ? 'Updating password...' : 'Update password'}
              </Button>
            </div>
          </form>
        </>
      ) : null}
    </SurfaceCard>
  );
}
