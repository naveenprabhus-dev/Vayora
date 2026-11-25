import type { ReactNode } from 'react';

export interface PageHeaderProps {
  readonly kicker?: string | undefined;
  readonly title: string;
  readonly description: string;
  readonly headingId?: string | undefined;
  readonly actions?: ReactNode;
}

export function PageHeader({
  kicker,
  title,
  description,
  headingId = 'page-heading',
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {kicker ? (
          <p className="font-mono text-xs font-semibold tracking-wide text-[#0F5132]">
            {kicker}
          </p>
        ) : null}
        <h1
          id={headingId}
          tabIndex={-1}
          className="font-display text-2xl font-bold tracking-tight text-slate-950 focus:outline-none sm:text-3xl"
        >
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-700">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
