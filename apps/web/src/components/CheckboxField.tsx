import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type'
> {
  readonly id: string;
  readonly label: ReactNode;
  readonly description?: string | undefined;
  readonly error?: string | undefined;
}

export function CheckboxField({ id, label, description, error, ...rest }: CheckboxFieldProps) {
  const descId = description ? `${id}-desc` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex min-h-11 items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-400 accent-[#0F5132]"
          {...rest}
        />
        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          <label htmlFor={id} className="block cursor-pointer font-medium text-slate-900">
            {label}
          </label>
          {description ? (
            <p id={descId} className="mt-0.5 text-xs text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
