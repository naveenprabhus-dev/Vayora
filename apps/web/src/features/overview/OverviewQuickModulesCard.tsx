import { ArrowRight } from 'lucide-react';
import { buildWorkspaceUrl } from '../../app/routing.ts';
import { SurfaceCard } from '../../components/index.ts';
import { WORKSPACE_NAV_ITEMS, type WorkspacePageId } from '../navigation/navConfig.ts';
import { handleWorkspaceLinkClick } from '../navigation/navigationUtils.ts';

const QUICK_MODULE_LINKS = WORKSPACE_NAV_ITEMS.filter(
  (item) => item.id !== 'overview' && item.id !== 'settings',
);

export interface OverviewQuickModulesCardProps {
  readonly onNavigate: (pageId: WorkspacePageId) => void;
}

export function OverviewQuickModulesCard({ onNavigate }: OverviewQuickModulesCardProps) {
  return (
    <SurfaceCard as="section" aria-labelledby="overview-modules-heading">
      <div className="border-b border-slate-200 pb-4">
        <h2 id="overview-modules-heading" className="text-lg font-bold text-slate-950">
          Quick Navigation to Modules
        </h2>
        <p className="mt-0.5 text-xs text-slate-600">
          Jump directly to dedicated tools and your saved household profile.
        </p>
      </div>

      <ul className="mt-4 divide-y divide-slate-200">
        {QUICK_MODULE_LINKS.map((item) => {
          const Icon = item.Icon;
          return (
            <li key={item.id} className="min-w-0">
              <a
                href={buildWorkspaceUrl(item.id)}
                onClick={(e) => handleWorkspaceLinkClick(e, item.id, onNavigate)}
                className="group flex min-h-11 min-w-0 items-center justify-between gap-3 py-3 text-sm transition-colors hover:text-[#0F5132] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132]"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Icon
                    className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-[#0F5132]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-950 group-hover:text-[#0F5132]">
                      {item.label}
                    </p>
                    <p className="truncate text-xs text-slate-600">{item.shortDescription}</p>
                  </div>
                </div>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#0F5132]"
                  aria-hidden="true"
                />
              </a>
            </li>
          );
        })}
      </ul>
    </SurfaceCard>
  );
}
