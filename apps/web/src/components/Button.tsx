import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly isLoading?: boolean;
  readonly children: ReactNode;
}

export function Button({
  variant = 'primary',
  isLoading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const variantStyles =
    variant === 'primary'
      ? 'bg-[#0F5132] text-white hover:bg-[#0B3D26] border border-transparent'
      : 'bg-white text-slate-900 hover:bg-slate-100 border border-slate-300';

  const isDisabled = Boolean(disabled || isLoading);

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${variantStyles} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
