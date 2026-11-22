import type { WinterSmogGuidance } from '@uaqa/contracts';
import { CloudFog, ShieldCheck } from 'lucide-react';
import { SurfaceCard } from '../../components/index.ts';

const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  outdoor_activity: 'Outdoor activity',
  exposure_reduction: 'Exposure reduction',
  ventilation: 'Indoor ventilation',
  household: 'Household habits',
  commute: 'Commute choice',
};

export interface WinterSmogGuidancePanelProps {
  readonly guidance: WinterSmogGuidance;
}

export function WinterSmogGuidancePanel({ guidance }: WinterSmogGuidancePanelProps) {
  return (
    <SurfaceCard as="section" aria-labelledby="winter-smog-guidance-heading">
      <div className="space-y-2 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 text-[#0F5132]">
          <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="font-mono text-xs font-semibold tracking-wider uppercase">
            Proportionate Practical Guidance
          </p>
        </div>
        <h2 id="winter-smog-guidance-heading" className="text-xl font-bold text-slate-950">
          {guidance.headline}
        </h2>
        <p className="text-sm leading-relaxed text-slate-700">{guidance.summary}</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {guidance.actions.map((action) => (
          <article key={action.id} className="rounded-lg bg-slate-50 p-4">
            <p className="font-mono text-xs font-semibold tracking-wider text-[#0F5132] uppercase">
              {CATEGORY_LABEL[action.category] ?? action.category}
            </p>
            <h3 className="mt-1 text-base font-bold text-slate-950">{action.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-800">{action.recommendation}</p>
            <p className="mt-2 text-xs text-slate-600">Basis: {action.evidenceBasis}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-800">
          <CloudFog className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-950">Cold weather &amp; fog vs. winter smog</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">
              {guidance.fogDistinctionNote}
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
          <p className="text-sm font-semibold text-slate-950">Guidance scope</p>
          <p className="mt-1">{guidance.guidanceScopeNote}</p>
        </div>
      </div>
    </SurfaceCard>
  );
}
