import type { InputHTMLAttributes } from 'react';

export interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
}

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className = '',
  ...rest
}: FormFieldProps) {
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

      <input
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`block min-h-11 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-950 placeholder:text-slate-500 transition-colors ${
          error ? 'border-red-600 focus-visible:outline-red-700' : 'border-slate-300'
        } ${className}`.trim()}
        {...rest}
      />

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
