import { loginInputSchema } from '@uaqa/contracts';
import { useState, type FormEvent } from 'react';
import {
  AlertBanner,
  Button,
  FormField,
  PasswordInput,
  SurfaceCard,
} from '../../components/index.ts';
import {
  AuthServiceError,
  type AuthService,
  type AuthUserSnapshot,
} from '../../lib/authService.ts';
import { extractZodFieldErrors } from './validationHelpers.ts';

export interface LoginFormProps {
  readonly authService: AuthService;
  readonly statusMessage?: string | undefined;
  readonly onAuthenticated: (user: AuthUserSnapshot) => Promise<void>;
  readonly onNavigateRegister: () => void;
  readonly onNavigateForgotPassword: () => void;
}

export function LoginForm({
  authService,
  statusMessage,
  onAuthenticated,
  onNavigateRegister,
  onNavigateForgotPassword,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = loginInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(extractZodFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const user = await authService.login(parsed.data);
      await onAuthenticated(user);
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setFormError(error.message);
      } else if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError('Unable to sign in right now. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SurfaceCard as="section" aria-labelledby="login-heading" className="mx-auto max-w-lg">
      <div className="space-y-2">
        <p className="font-mono text-xs font-medium tracking-wide text-slate-600 uppercase">
          Household Account Access
        </p>
        <h1 id="login-heading" className="text-2xl font-bold tracking-tight text-slate-950">
          Sign in to Urban Air Quality Assistant
        </h1>
        <p className="text-sm leading-relaxed text-slate-700">
          A verified household account is required to access location-specific smog resilience
          guidance. Guest access is disabled.
        </p>
      </div>

      {statusMessage ? (
        <div className="mt-5">
          <AlertBanner tone="success" title="Update">
            <p>{statusMessage}</p>
          </AlertBanner>
        </div>
      ) : null}

      {formError ? (
        <div className="mt-5">
          <AlertBanner tone="error" title="Sign in failed">
            <p>{formError}</p>
          </AlertBanner>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <FormField
          id="login-email"
          label="Email address"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          placeholder="parent@household.org"
        />

        <PasswordInput
          id="login-password"
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onNavigateForgotPassword}
            className="min-h-11 rounded-md px-2 text-sm font-medium text-[#0F5132] underline-offset-4 hover:underline"
          >
            Forgot password?
          </button>

          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-700">
        <span>New household member? </span>
        <button
          type="button"
          onClick={onNavigateRegister}
          className="min-h-11 rounded-md px-2 font-semibold text-[#0F5132] underline-offset-4 hover:underline"
        >
          Create an account
        </button>
      </div>
    </SurfaceCard>
  );
}
