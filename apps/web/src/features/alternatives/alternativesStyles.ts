import type {
  AlternativeImpactClassification,
  AlternativeSuitabilityStatus,
} from '@uaqa/contracts';
import { AlertTriangle, Ban, CheckCircle2, Flame, Leaf, ShieldCheck, Sparkles } from 'lucide-react';

export function getSuitabilityVisual(status: AlternativeSuitabilityStatus): {
  readonly label: string;
  readonly surfaceClass: string;
  readonly textClass: string;
  readonly Icon: typeof CheckCircle2;
} {
  switch (status) {
    case 'recommended':
      return {
        label: 'Suitable now',
        surfaceClass: 'border-emerald-200 bg-emerald-50/50',
        textClass: 'text-emerald-950',
        Icon: CheckCircle2,
      };
    case 'conditional':
      return {
        label: 'Conditional',
        surfaceClass: 'border-amber-200 bg-amber-50/50',
        textClass: 'text-amber-950',
        Icon: AlertTriangle,
      };
    case 'not_advised_now':
      return {
        label: 'Not advised outdoors now',
        surfaceClass: 'border-rose-200 bg-rose-50/60',
        textClass: 'text-rose-950',
        Icon: Ban,
      };
  }
}

export function getImpactClassificationVisual(classification: AlternativeImpactClassification): {
  readonly shortLabel: string;
  readonly textClass: string;
  readonly Icon: typeof Leaf;
} {
  switch (classification) {
    case 'local_emissions':
      return {
        shortLabel: 'Reduces local emissions',
        textClass: 'text-[#0F5132]',
        Icon: Flame,
      };
    case 'personal_exposure':
      return {
        shortLabel: 'Reduces personal exposure',
        textClass: 'text-sky-900',
        Icon: ShieldCheck,
      };
    case 'both_exposure_and_emissions':
      return {
        shortLabel: 'Exposure & emissions co-benefit',
        textClass: 'text-emerald-900',
        Icon: Sparkles,
      };
    case 'broader_sustainability':
      return {
        shortLabel: 'Broader sustainability benefit',
        textClass: 'text-slate-800',
        Icon: Leaf,
      };
  }
}
