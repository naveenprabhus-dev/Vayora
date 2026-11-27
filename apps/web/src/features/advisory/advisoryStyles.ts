import type {
  AdvisoryGenerationMode,
  AdvisoryImpactCategory,
  AdvisorySourceModule,
} from '@uaqa/contracts';
import { Bot, CloudSun, Cpu, Flame, Filter, Leaf, ShieldCheck, Sparkles } from 'lucide-react';

export function getAdvisoryImpactVisual(category: AdvisoryImpactCategory): {
  readonly label: string;
  readonly textClass: string;
  readonly Icon: typeof ShieldCheck;
} {
  switch (category) {
    case 'personal_exposure':
      return {
        label: 'Personal exposure reduction',
        textClass: 'text-sky-900',
        Icon: ShieldCheck,
      };
    case 'local_emissions':
      return {
        label: 'Local emissions reduction',
        textClass: 'text-[#0F5132]',
        Icon: Flame,
      };
    case 'both':
      return {
        label: 'Exposure & emissions co-benefit',
        textClass: 'text-emerald-950',
        Icon: Sparkles,
      };
    case 'indoor_filtration':
      return {
        label: 'Indoor particle filtration',
        textClass: 'text-indigo-950',
        Icon: Filter,
      };
    case 'greenhouse_gas':
      return {
        label: 'Greenhouse gas / climate',
        textClass: 'text-teal-950',
        Icon: CloudSun,
      };
    case 'broader_sustainability':
      return {
        label: 'Broader sustainability',
        textClass: 'text-slate-800',
        Icon: Leaf,
      };
    default:
      return {
        label: 'Environmental guidance',
        textClass: 'text-slate-800',
        Icon: Leaf,
      };
  }
}

export function getGenerationModeVisual(mode: AdvisoryGenerationMode): {
  readonly label: string;
  readonly textClass: string;
  readonly Icon: typeof Bot;
} {
  if (mode === 'gemini') {
    return {
      label: 'AI-generated explanation (verified grounding)',
      textClass: 'text-[#0F5132]',
      Icon: Bot,
    };
  }
  return {
    label: 'Deterministic fallback explanation',
    textClass: 'text-amber-950',
    Icon: Cpu,
  };
}

export function getSourceModuleLabel(sourceModule: AdvisorySourceModule): string {
  switch (sourceModule) {
    case 'routines':
      return 'Daily Routines';
    case 'indoor':
      return 'Indoor Air Assistant';
    case 'alternatives':
      return 'Sustainable Alternatives';
    default:
      return 'VAYORA Module';
  }
}
