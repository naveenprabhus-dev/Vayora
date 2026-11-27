import { registrationInputSchema } from '@uaqa/contracts';
import { useState, type FormEvent } from 'react';
import {
  AlertBanner,
  Button,
  CheckboxField,
  FormField,
  PasswordInput,
  PasswordStrengthMeter,
  SurfaceCard,
} from '../../components/index.ts';
import type { AuthService, AuthUserSnapshot } from '../../lib/authService.ts';
import { formatSafeUserError } from '../../lib/errorMessages.ts';
import { extractZodFieldErrors } from './validationHelpers.ts';

export interface RegisterFormProps {
  readonly authService: AuthService;
  readonly onRegistered: (user: AuthUserSnapshot, termsAcceptedAtIso: string) => void;
  readonly onNavigateLogin: () => void;
}

export function RegisterForm({ authService, onRegistered, onNavigateLogin }: RegisterFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = registrationInputSchema.safeParse({
      displayName,
      email,
      password,
      confirmPassword,
      acceptedTerms,
    });

    if (!parsed.success) {
      setFieldErrors(extractZodFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const user = await authService.register(parsed.data);
      onRegistered(user, new Date().toISOString());
    } catch (error) {
      setFormError(
        formatSafeUserError(error, 'Unable to create your account right now. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SurfaceCard as="section" aria-labelledby="register-heading" className="mx-auto max-w-lg">
      <div className="space-y-2">
        <p className="font-mono text-xs font-medium tracking-wide text-slate-600 uppercase">
          Step 1 · Account Registration
        </p>
        <h1 id="register-heading" className="text-2xl font-bold tracking-tight text-slate-950">
          Create your household account
        </h1>
        <p className="text-sm leading-relaxed text-slate-700">
          All accounts start with standard household permissions and require email verification
          before onboarding.
        </p>
      </div>

      {formError ? (
        <div className="mt-5">
          <AlertBanner tone="error" title="Registration could not be completed">
            <p>{formError}</p>
          </AlertBanner>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <FormField
          id="register-name"
          label="Full name"
          type="text"
          autoComplete="name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldErrors.displayName}
          placeholder="Elena Nowak"
        />

        <FormField
          id="register-email"
          label="Email address"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          placeholder="elena@household.org"
          hint="We will send a one-time verification link to this address."
        />

        <div className="space-y-3">
          <PasswordInput
            id="register-password"
            label="Password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <PasswordInput
          id="register-confirm-password"
          label="Confirm password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
        />

        <CheckboxField
          id="register-terms"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          label="I acknowledge the Terms of Use and Privacy Notice"
          description="Your email address is stored in an access-isolated private subcollection separate from household air-quality preferences, and is never used for medical records."
          error={fieldErrors.acceptedTerms}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onNavigateLogin}
            className="min-h-11 rounded-md px-2 text-sm font-medium text-[#0F5132] underline-offset-4 hover:underline"
          >
            Already have an account? Sign in
          </button>

          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </div>
      </form>
    </SurfaceCard>
  );
}
