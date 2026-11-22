import type { AqiReadingSummary, PollutantDetail } from '@uaqa/contracts';
import { AlertTriangle, CheckCircle2, HelpCircle, Info, ShieldAlert } from 'lucide-react';

export interface SeverityVisualSpec {
  readonly surfaceClass: string;
  readonly textClass: string;
  readonly accentBorderClass: string;
  readonly statusTag: string;
  readonly Icon: typeof Info;
}

export function getAqiSeverityVisual(
  token: AqiReadingSummary['severityToken'],
): SeverityVisualSpec {
  switch (token) {
    case 'good':
      return {
        surfaceClass: 'bg-emerald-50 border-emerald-200',
        textClass: 'text-emerald-950',
        accentBorderClass: 'border-emerald-300',
        statusTag: 'Low risk band',
        Icon: CheckCircle2,
      };
    case 'moderate':
      return {
        surfaceClass: 'bg-amber-50 border-amber-200',
        textClass: 'text-amber-950',
        accentBorderClass: 'border-amber-300',
        statusTag: 'Moderate band',
        Icon: Info,
      };
    case 'elevated':
      return {
        surfaceClass: 'bg-orange-50 border-orange-200',
        textClass: 'text-orange-950',
        accentBorderClass: 'border-orange-300',
        statusTag: 'Elevated band',
        Icon: AlertTriangle,
      };
    case 'high':
    case 'very_high':
      return {
        surfaceClass: 'bg-red-50 border-red-200',
        textClass: 'text-red-950',
        accentBorderClass: 'border-red-300',
        statusTag: token === 'very_high' ? 'Very high band' : 'High band',
        Icon: ShieldAlert,
      };
    case 'unavailable':
    default:
      return {
        surfaceClass: 'bg-slate-100 border-slate-300',
        textClass: 'text-slate-900',
        accentBorderClass: 'border-slate-300',
        statusTag: 'Unavailable',
        Icon: HelpCircle,
      };
  }
}

export function getPollutantBandVisual(band: PollutantDetail['concentrationBand']): {
  readonly textClass: string;
  readonly borderClass: string;
  readonly bgClass: string;
  readonly Icon: typeof Info;
} {
  switch (band) {
    case 'low':
      return {
        textClass: 'text-emerald-900',
        borderClass: 'border-emerald-200',
        bgClass: 'bg-emerald-50',
        Icon: CheckCircle2,
      };
    case 'moderate':
      return {
        textClass: 'text-amber-950',
        borderClass: 'border-amber-200',
        bgClass: 'bg-amber-50',
        Icon: Info,
      };
    case 'elevated':
      return {
        textClass: 'text-orange-950',
        borderClass: 'border-orange-200',
        bgClass: 'bg-orange-50',
        Icon: AlertTriangle,
      };
    case 'high':
      return {
        textClass: 'text-red-950',
        borderClass: 'border-red-200',
        bgClass: 'bg-red-50',
        Icon: ShieldAlert,
      };
    case 'unavailable':
    default:
      return {
        textClass: 'text-slate-700',
        borderClass: 'border-slate-200',
        bgClass: 'bg-slate-50',
        Icon: HelpCircle,
      };
  }
}

export function formatIsoTimestamp(iso: string | null | undefined, timezone?: string): string {
  if (!iso) {
    return 'Unavailable';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  try {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone && timezone.trim().length > 0 ? timezone : 'UTC',
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }
}
