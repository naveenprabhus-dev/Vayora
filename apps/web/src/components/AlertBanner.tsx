import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export type AlertTone = 'info' | 'success' | 'warning' | 'error';

export interface AlertBannerProps {
  readonly tone: AlertTone;
  readonly title: string;
  readonly children: ReactNode;
}

const TONE_CONFIG: Record<
  AlertTone,
  {
    readonly role: 'status' | 'alert';
    readonly label: string;
    readonly containerClass: string;
    readonly iconClass: string;
    readonly Icon: typeof Info;
  }
> = {
  info: {
    role: 'status',
    label: 'Information',
    containerClass: 'border-slate-300 bg-white text-slate-900',
    iconClass: 'text-slate-700',
    Icon: Info,
  },
  success: {
    role: 'status',
    label: 'Verified',
    containerClass: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    iconClass: 'text-emerald-800',
    Icon: CheckCircle2,
  },
  warning: {
    role: 'status',
    label: 'Notice',
    containerClass: 'border-amber-300 bg-amber-50 text-amber-950',
    iconClass: 'text-amber-800',
    Icon: AlertTriangle,
  },
  error: {
    role: 'alert',
    label: 'Error',
    containerClass: 'border-red-300 bg-red-50 text-red-950',
    iconClass: 'text-red-800',
    Icon: XCircle,
  },
};

export function AlertBanner({ tone, title, children }: AlertBannerProps) {
  const config = TONE_CONFIG[tone];
  const Icon = config.Icon;

  return (
    <div
      role={config.role}
      aria-live={config.role === 'alert' ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 rounded-lg border p-4 ${config.containerClass}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconClass}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p className="font-semibold">
          <span>{config.label}: </span>
          {title}
        </p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
