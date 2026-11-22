import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';

export interface PasswordInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type'
> {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
}

export function PasswordInput({
  id,
  label,
  hint,
  error,
  required,
  className = '',
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
        {required ? (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div className="relative flex items-center">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`block min-h-11 w-full rounded-lg border bg-white py-2.5 pr-12 pl-3.5 text-sm text-slate-950 placeholder:text-slate-500 transition-colors ${
            error ? 'border-red-600 focus-visible:outline-red-700' : 'border-slate-300'
          } ${className}`.trim()}
          {...rest}
        />

        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-pressed={visible}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          className="absolute right-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 hover:text-slate-950"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-slate-600">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
