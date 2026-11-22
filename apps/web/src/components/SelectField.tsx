import type { ReactNode, SelectHTMLAttributes } from 'react';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  readonly id: string;
  readonly label: string;
  readonly options: readonly SelectOption[];
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly children?: ReactNode;
}

export function SelectField({
  id,
  label,
  options,
  hint,
  error,
  required,
  className = '',
  ...rest
}: SelectFieldProps) {
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

      <select
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`block min-h-11 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-950 transition-colors ${
          error ? 'border-red-600 focus-visible:outline-red-700' : 'border-slate-300'
        } ${className}`.trim()}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

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
