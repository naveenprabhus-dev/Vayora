import { evaluatePasswordStrength, PASSWORD_MIN_LENGTH } from '@uaqa/contracts';
import { Check, Circle } from 'lucide-react';

export interface PasswordStrengthMeterProps {
  readonly password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const assessment = evaluatePasswordStrength(password);
  const criteria = [
    {
      key: 'minLength',
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: assessment.checks.minLength,
    },
    {
      key: 'hasUppercase',
      label: 'One uppercase letter (A-Z)',
      met: assessment.checks.hasUppercase,
    },
    {
      key: 'hasLowercase',
      label: 'One lowercase letter (a-z)',
      met: assessment.checks.hasLowercase,
    },
    { key: 'hasDigit', label: 'One number (0-9)', met: assessment.checks.hasDigit },
    {
      key: 'hasSpecial',
      label: 'One special character (!@#$...)',
      met: assessment.checks.hasSpecial,
    },
  ] as const;

  return (
    <div
      className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="font-semibold text-slate-800">Password strength</span>
        <span className="font-mono font-medium text-slate-900">{assessment.label}</span>
      </div>

      <progress
        aria-label="Password strength"
        aria-valuetext={assessment.label}
        max={4}
        value={password.length === 0 ? 0 : assessment.score}
        className={`block h-2 w-full overflow-hidden rounded-sm bg-slate-200 [&::-webkit-progress-bar]:bg-slate-200 ${
          password.length === 0
            ? '[&::-webkit-progress-value]:bg-slate-200'
            : assessment.score <= 1
              ? 'accent-red-600 [&::-webkit-progress-value]:bg-red-600 [&::-moz-progress-bar]:bg-red-600'
              : assessment.score === 2
                ? 'accent-amber-600 [&::-webkit-progress-value]:bg-amber-600 [&::-moz-progress-bar]:bg-amber-600'
                : 'accent-[#0F5132] [&::-webkit-progress-value]:bg-[#0F5132] [&::-moz-progress-bar]:bg-[#0F5132]'
        }`}
      />

      <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
        {criteria.map((item) => (
          <li
            key={item.key}
            className={`flex items-center gap-2 ${
              item.met ? 'font-medium text-emerald-900' : 'text-slate-700'
            }`}
          >
            {item.met ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-[#0F5132]" aria-hidden="true" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            )}
            <span>
              {item.met ? 'Met: ' : 'Required: '}
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
