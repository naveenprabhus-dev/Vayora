import type {
  IndoorActionStatus,
  IndoorInformationCategory,
  IndoorVentilationState,
} from '@uaqa/contracts';
import {
  AlertTriangle,
  Ban,
  BookOpen,
  CheckCircle2,
  CloudSun,
  Home,
  Info,
  ShieldAlert,
  Wind,
} from 'lucide-react';

export function getVentilationStateVisual(state: IndoorVentilationState): {
  readonly label: string;
  readonly surfaceClass: string;
  readonly textClass: string;
  readonly Icon: typeof Wind;
} {
  switch (state) {
    case 'consider_ventilation':
      return {
        label: 'Favourable conditions',
        surfaceClass: 'border-emerald-200 bg-emerald-50/70',
        textClass: 'text-emerald-950',
        Icon: CheckCircle2,
      };
    case 'shorter_timed_ventilation':
      return {
        label: 'Shorter timed airing',
        surfaceClass: 'border-sky-200 bg-sky-50/70',
        textClass: 'text-sky-950',
        Icon: Wind,
      };
    case 'delay_optional_ventilation':
      return {
        label: 'Delay optional airing',
        surfaceClass: 'border-amber-200 bg-amber-50/70',
        textClass: 'text-amber-950',
        Icon: ShieldAlert,
      };
    case 'insufficient_data':
      return {
        label: 'Insufficient telemetry',
        surfaceClass: 'border-slate-300 bg-slate-100',
        textClass: 'text-slate-900',
        Icon: Ban,
      };
  }
}

export function getIndoorActionStatusVisual(status: IndoorActionStatus): {
  readonly label: string;
  readonly surfaceClass: string;
  readonly textClass: string;
  readonly Icon: typeof CheckCircle2;
} {
  switch (status) {
    case 'recommended':
      return {
        label: 'Recommended',
        surfaceClass: 'border-emerald-200 bg-emerald-50/60',
        textClass: 'text-emerald-950',
        Icon: CheckCircle2,
      };
    case 'optional':
      return {
        label: 'Simulated option',
        surfaceClass: 'border-sky-200 bg-sky-50/60',
        textClass: 'text-sky-950',
        Icon: Info,
      };
    case 'caution':
      return {
        label: 'Caution / Safety',
        surfaceClass: 'border-amber-200 bg-amber-50/70',
        textClass: 'text-amber-950',
        Icon: AlertTriangle,
      };
    case 'not_applicable':
      return {
        label: 'Not applicable',
        surfaceClass: 'border-slate-200 bg-slate-50',
        textClass: 'text-slate-700',
        Icon: Ban,
      };
  }
}

export function getEvidenceCategoryVisual(category: IndoorInformationCategory): {
  readonly shortLabel: string;
  readonly textClass: string;
  readonly Icon: typeof BookOpen;
} {
  switch (category) {
    case 'measured_indoor':
      return {
        shortLabel: 'Measured indoor air quality',
        textClass: 'text-slate-800',
        Icon: Ban,
      };
    case 'outdoor_air_quality':
      return {
        shortLabel: 'Outdoor air-quality data',
        textClass: 'text-sky-900',
        Icon: CloudSun,
      };
    case 'estimated_inferred_indoor':
      return {
        shortLabel: 'Estimated indoor context',
        textClass: 'text-[#0F5132]',
        Icon: Home,
      };
    case 'general_educational_guidance':
      return {
        shortLabel: 'General educational guidance',
        textClass: 'text-slate-800',
        Icon: BookOpen,
      };
  }
}
