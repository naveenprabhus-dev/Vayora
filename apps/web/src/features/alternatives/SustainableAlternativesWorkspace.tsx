import type {
  AlternativeComparisonView,
  AlternativesQueryInput,
  HouseholdLifestyleRecord,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import { useCallback, useState } from 'react';
import {
  AlertBanner,
  Button,
  SurfaceCard,
  WorkspaceErrorRetryBanner,
  WorkspaceLoadingCard,
} from '../../components/index.ts';
import { useWorkspaceResource } from '../../hooks/useWorkspaceResource.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import { formatWorkspaceError } from '../../lib/errorMessages.ts';
import { buildProfileSyncKey } from '../../lib/profileSync.ts';
import { AlternativeComparisonPanel } from './AlternativeComparisonPanel.tsx';
import { AlternativeRecommendationCard } from './AlternativeRecommendationCard.tsx';
import {
  AlternativesOverviewSection,
  type AffordabilityFilter,
  type CategoryFilter,
  type ImpactClassificationFilter,
  type PracticalityFilter,
  type RelevanceFilter,
} from './AlternativesOverviewSection.tsx';

export interface SustainableAlternativesWorkspaceProps {
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly airQualitySyncToken?: string | undefined;
  readonly onSessionIssue?: ((error: unknown) => void) | undefined;
}

export function SustainableAlternativesWorkspace({
  profile,
  apiClient,
  airQualitySyncToken,
  onSessionIssue,
}: SustainableAlternativesWorkspaceProps) {
  const [selectedComparison, setSelectedComparison] = useState<AlternativeComparisonView | null>(
    null,
  );
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [affordabilityFilter, setAffordabilityFilter] = useState<AffordabilityFilter>('all');
  const [relevanceFilter, setRelevanceFilter] = useState<RelevanceFilter>('all');
  const [impactFilter, setImpactFilter] = useState<ImpactClassificationFilter>('all');
  const [practicalityFilter, setPracticalityFilter] = useState<PracticalityFilter>('all');
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const profileSyncKey = buildProfileSyncKey(profile);
  const enabled = profileSyncKey.length > 0 && airQualitySyncToken !== '__never__';
  const requestKey = [
    profileSyncKey,
    airQualitySyncToken ?? '',
    categoryFilter,
    affordabilityFilter,
    relevanceFilter,
    impactFilter,
    practicalityFilter,
  ].join('|');

  const buildFilterQuery = useCallback(
    (): AlternativesQueryInput => ({
      ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      ...(affordabilityFilter !== 'all' ? { affordability: affordabilityFilter } : {}),
      ...(relevanceFilter !== 'all' ? { relevance: relevanceFilter } : {}),
      ...(impactFilter !== 'all' ? { impactType: impactFilter } : {}),
      ...(practicalityFilter !== 'all' ? { practicality: practicalityFilter } : {}),
    }),
    [categoryFilter, affordabilityFilter, relevanceFilter, impactFilter, practicalityFilter],
  );

  const fetcher = useCallback(
    () => apiClient.getSustainableAlternatives(buildFilterQuery()),
    [apiClient, buildFilterQuery],
  );

  const refresher = useCallback(
    () =>
      apiClient.refreshSustainableAlternatives({
        forceRefresh: true,
        ...buildFilterQuery(),
      }),
    [apiClient, buildFilterQuery],
  );

  const handleAlternativesLoaded = useCallback((response: SustainableAlternativesResponse) => {
    setSelectedComparison(response.featuredComparison);
    setCompareError(null);
  }, []);

  const {
    data: alternativesData,
    error: loadError,
    isLoading,
    isRefreshing,
    refresh,
  } = useWorkspaceResource({
    requestKey,
    enabled,
    moduleLabel: 'Sustainable Alternatives Advisor',
    fetcher,
    refresher,
    onLoaded: handleAlternativesLoaded,
    onSessionIssue,
  });

  const handleCompare = useCallback(
    async (alternativeId: string, currentOption?: string) => {
      setIsComparing(true);
      setCompareError(null);
      try {
        const comparison = await apiClient.compareSustainableAlternative({
          alternativeId,
          ...(currentOption !== undefined ? { currentOption } : {}),
        });
        setSelectedComparison(comparison);
      } catch (error) {
        onSessionIssue?.(error);
        setCompareError(formatWorkspaceError(error, 'Sustainable Choice Comparison'));
      } finally {
        setIsComparing(false);
      }
    },
    [apiClient, onSessionIssue],
  );

  const handleResetFilters = useCallback(() => {
    setCategoryFilter('all');
    setAffordabilityFilter('all');
    setRelevanceFilter('all');
    setImpactFilter('all');
    setPracticalityFilter('all');
  }, []);

  if (isLoading && !alternativesData) {
    return (
      <WorkspaceLoadingCard
        headingId="alternatives-loading-heading"
        title="Preparing Sustainable Alternatives Advisor..."
        description={`Evaluating practical transport, household energy, everyday habit, and waste choices for ${profile.city}.`}
      />
    );
  }

  if (loadError && !alternativesData) {
    return (
      <WorkspaceErrorRetryBanner
        title="Sustainable Alternatives Advisor failed to load"
        error={loadError}
        retryLabel="Retry alternatives"
        onRetry={() => void refresh()}
      />
    );
  }

  if (!alternativesData) {
    return null;
  }

  const activeError = loadError ?? compareError;

  return (
    <div className="space-y-6" data-testid="sustainable-alternatives-workspace">
      {activeError ? (
        <AlertBanner tone="error" title="Alternatives notice">
          <p>{activeError}</p>
        </AlertBanner>
      ) : null}

      <AlternativesOverviewSection
        data={alternativesData}
        categoryFilter={categoryFilter}
        affordabilityFilter={affordabilityFilter}
        relevanceFilter={relevanceFilter}
        impactFilter={impactFilter}
        practicalityFilter={practicalityFilter}
        isRefreshing={isRefreshing}
        onSelectCategory={setCategoryFilter}
        onSelectAffordability={setAffordabilityFilter}
        onSelectRelevance={setRelevanceFilter}
        onSelectImpact={setImpactFilter}
        onSelectPracticality={setPracticalityFilter}
        onResetFilters={handleResetFilters}
        onRefresh={() => void refresh()}
      />

      {selectedComparison ? (
        <AlternativeComparisonPanel
          comparison={selectedComparison}
          isComparing={isComparing}
          onSelectBaseline={(alternativeId, baselineId) =>
            void handleCompare(alternativeId, baselineId)
          }
        />
      ) : null}

      {alternativesData.alternatives.length === 0 ? (
        <SurfaceCard as="section" aria-labelledby="alternatives-empty-heading">
          <h3 id="alternatives-empty-heading" className="text-lg font-bold text-slate-950">
            No sustainable alternatives match your current filter combination
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Reset the filters to inspect all practical transport, home heating, everyday activity,
            and waste alternatives tailored to your household.
          </p>
          <div className="mt-4">
            <Button type="button" variant="secondary" onClick={handleResetFilters}>
              Reset all filters
            </Button>
          </div>
        </SurfaceCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {alternativesData.alternatives.map((item) => (
            <AlternativeRecommendationCard
              key={item.id}
              item={item}
              isSelectedForComparison={selectedComparison?.alternativeId === item.id}
              onCompare={(alternativeId) => void handleCompare(alternativeId)}
            />
          ))}
        </div>
      )}

      <SurfaceCard as="section" aria-labelledby="alternatives-provenance-heading">
        <h3 id="alternatives-provenance-heading" className="text-sm font-bold text-slate-950">
          Methodology &amp; Transparency
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-700">
          {alternativesData.provenanceAndDisclosures.methodologicalPrinciples.map((principle) => (
            <li key={principle}>{principle}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {alternativesData.provenanceAndDisclosures.limitationsSummary}
        </p>
      </SurfaceCard>
    </div>
  );
}
