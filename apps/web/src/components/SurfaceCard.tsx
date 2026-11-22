import type { HTMLAttributes, ReactNode } from 'react';

export interface SurfaceCardProps extends HTMLAttributes<HTMLElement> {
  readonly as?: 'section' | 'div' | 'article';
  readonly className?: string;
  readonly children: ReactNode;
}

export function SurfaceCard({
  as: Component = 'section',
  className = '',
  children,
  ...rest
}: SurfaceCardProps) {
  return (
    <Component
      className={`rounded-xl border border-slate-200 bg-white p-6 ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  );
}
