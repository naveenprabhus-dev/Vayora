import type { ReactNode } from 'react';

export interface SurfaceCardProps {
  readonly as?: 'section' | 'div' | 'article';
  readonly className?: string;
  readonly children: ReactNode;
}

export function SurfaceCard({
  as: Component = 'section',
  className = '',
  children,
}: SurfaceCardProps) {
  return (
    <Component className={`rounded-xl border border-slate-200 bg-white p-6 ${className}`.trim()}>
      {children}
    </Component>
  );
}
