import type {
  InformationBasis,
  RoutineActionStatus,
  RoutineImpactType,
  RoutineRecommendationItem,
} from '@uaqa/contracts';
import { Ban, CheckCircle2, Info, Leaf, Shield, Sparkles } from 'lucide-react';

export interface RoutineStatusVisualSpec {
  readonly label: string;
  readonly surfaceClass: string;
  readonly textClass: string;
  readonly Icon: typeof CheckCircle2;
}

export function getRoutineStatusVisual(status: RoutineActionStatus): RoutineStatusVisualSpec {
  switch (status) {
    case 'recommended':
      return {
        label: 'Recommended',
        surfaceClass: 'border-emerald-200 bg-emerald-50/70',
        textClass: 'text-emerald-950',
        Icon: CheckCircle2,
      };
    case 'optional':
      return {
        label: 'Optional',
        surfaceClass: 'border-slate-200 bg-slate-50',
        textClass: 'text-slate-900',
        Icon: Info,
      };
    case 'unavailable':
      return {
        label: 'Unavailable',
        surfaceClass: 'border-amber-200 bg-amber-50/70',
        textClass: 'text-amber-950',
        Icon: Ban,
      };
    default:
      return {
        label: 'Routine guidance',
        surfaceClass: 'border-slate-200 bg-slate-50',
        textClass: 'text-slate-900',
        Icon: Info,
      };
  }
}

export function getImpactTypeVisual(impactType: RoutineImpactType): {
  readonly label: string;
  readonly textClass: string;
  readonly Icon: typeof Shield;
} {
  switch (impactType) {
    case 'exposure_reduction':
      return {
        label: 'Personal exposure reduction',
        textClass: 'text-sky-900',
        Icon: Shield,
      };
    case 'emission_reduction':
      return {
        label: 'Local emission reduction',
        textClass: 'text-emerald-900',
        Icon: Leaf,
      };
    case 'both':
      return {
        label: 'Exposure & emission reduction',
        textClass: 'text-[#0F5132]',
        Icon: Sparkles,
      };
    default:
      return {
        label: 'Air-quality routine benefit',
        textClass: 'text-slate-800',
        Icon: Shield,
      };
  }
}

export const CATEGORY_LABELS: Readonly<Record<RoutineRecommendationItem['category'], string>> = {
  commute: 'Commute',
  outdoor_activity: 'Outdoor activity',
  errands: 'Errands & trips',
  household_energy: 'Household routine',
  scheduling: 'Time scheduling',
};

export const INFORMATION_BASIS_LABELS: Readonly<Record<InformationBasis, string>> = {
  model_derived: 'Model-derived forecast & AQI',
  rule_derived: 'Profile & environmental rule',
  qualitative_estimate: 'Qualitative clean-air practice',
  unavailable: 'Telemetry unavailable',
};
