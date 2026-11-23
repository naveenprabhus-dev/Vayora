import type { IndoorPollutionSourceGuide, IndoorPollutionSourceId } from '@uaqa/contracts';
import { useState } from 'react';
import { SurfaceCard } from '../../components/index.ts';

export interface PollutionSourcesSectionProps {
  readonly pollutionSources: readonly IndoorPollutionSourceGuide[];
}

export function PollutionSourcesSection({ pollutionSources }: PollutionSourcesSectionProps) {
  const [selectedSourceId, setSelectedSourceId] = useState<'all' | IndoorPollutionSourceId>('all');

  const visibleSources =
    selectedSourceId === 'all'
      ? pollutionSources
      : pollutionSources.filter((src) => src.id === selectedSourceId);

  return (
    <SurfaceCard as="section" aria-labelledby="indoor-sources-heading">
      <div className="space-y-1.5 border-b border-slate-200 pb-4">
        <p className="font-mono text-xs font-semibold tracking-wider text-[#0F5132] uppercase">
          Common Indoor Pollution Sources · General Educational Guidance
        </p>
        <h3 id="indoor-sources-heading" className="text-xl font-bold text-slate-950">
          Understanding Everyday Indoor Air Sources &amp; Low-Cost Controls
        </h3>
        <p className="text-xs leading-relaxed text-slate-600">
          Practical source-control guidance prioritizing accessible habits without assuming every
          household owns identical appliances.
        </p>

        <fieldset className="mt-3 flex flex-wrap gap-1.5 pt-2">
          <legend className="sr-only">Filter common indoor pollution sources</legend>
          <button
            type="button"
            aria-pressed={selectedSourceId === 'all'}
            onClick={() => setSelectedSourceId('all')}
            className={`min-h-11 rounded-md border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedSourceId === 'all'
                ? 'border-[#0F5132] bg-[#0F5132] text-white'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            All 7 sources
          </button>
          {pollutionSources.map((src) => (
            <button
              key={src.id}
              type="button"
              aria-pressed={selectedSourceId === src.id}
              onClick={() => setSelectedSourceId(src.id)}
              className={`min-h-11 rounded-md border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedSourceId === src.id
                  ? 'border-[#0F5132] bg-[#0F5132] text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
              }`}
            >
              {src.title.split('(')[0]?.trim() ?? src.title}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {visibleSources.map((source) => (
          <article
            key={source.id}
            data-testid={`indoor-source-${source.id}`}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-5"
          >
            <p className="text-xs font-semibold text-slate-600">General educational guidance</p>
            <h4 className="mt-1 text-base font-bold text-slate-950">{source.title}</h4>

            <dl className="mt-3.5 space-y-2.5 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-800">
              <div>
                <dt className="font-bold text-slate-950 uppercase">1. What the source is</dt>
                <dd className="mt-0.5">{source.whatItIs}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-950 uppercase">2. How it affects indoor air</dt>
                <dd className="mt-0.5">{source.howItAffectsIndoorAir}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-950 uppercase">3. Practical low-cost steps</dt>
                <dd className="mt-0.5">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {source.practicalReductionSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-950 uppercase">4. Relevant precautions</dt>
                <dd className="mt-0.5">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {source.relevantPrecautions.map((precaution) => (
                      <li key={precaution}>{precaution}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-950 uppercase">5. Limitations</dt>
                <dd className="mt-0.5 text-slate-700">{source.limitations}</dd>
              </div>
              <div>
                <dt className="sr-only">Reference basis</dt>
                <dd className="pt-1 text-[11px] text-slate-600">Basis: {source.sourceReference}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </SurfaceCard>
  );
}
