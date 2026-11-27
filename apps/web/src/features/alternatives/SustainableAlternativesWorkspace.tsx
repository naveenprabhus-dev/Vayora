import type {
  AlternativeComparisonView,
  AlternativesQueryInput,
  HouseholdLifestyleRecord,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import { useCallback, useEffect, useState } from 'react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
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
  const [alternativesData, setAlternativesData] = useState<SustainableAlternativesResponse | null>(
    null,
  );
  const [selectedComparison, setSelectedComparison] = useState<AlternativeComparisonView | null>(
    null,
  );
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [affordabilityFilter, setAffordabilityFilter] = useState<AffordabilityFilter>('all');
  const [relevanceFilter, setRelevanceFilter] = useState<RelevanceFilter>('all');
  const [impactFilter, setImpactFilter] = useState<ImpactClassificationFilter>('all');
  const [practicalityFilter, setPracticalityFilter] = useState<PracticalityFilter>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const profileSyncKey = buildProfileSyncKey(profile);

  useEffect(() => {
    let cancelled = false;

    async function loadAlternatives() {
      setLoadError(null);
      try {
        const query: AlternativesQueryInput = {
          ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
          ...(affordabilityFilter !== 'all' ? { affordability: affordabilityFilter } : {}),
          ...(relevanceFilter !== 'all' ? { relevance: relevanceFilter } : {}),
          ...(impactFilter !== 'all' ? { impactType: impactFilter } : {}),
          ...(practicalityFilter !== 'all' ? { practicality: practicalityFilter } : {}),
        };
        const response = await apiClient.getSustainableAlternatives(query);
        if (!cancelled) {
          setAlternativesData(response);
          setSelectedComparison(response.featuredComparison);
        }
      } catch (error) {
        if (!cancelled) {
          onSessionIssue?.(error);
          setLoadError(formatWorkspaceError(error, 'Sustainable Alternatives Advisor'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    if (profileSyncKey.length > 0 && airQualitySyncToken !== '__never__') {
      void loadAlternatives();
    }

    return () => {
      cancelled = true;
    };
  }, [
    apiClient,
    airQualitySyncToken,
    categoryFilter,
    affordabilityFilter,
    relevanceFilter,
    impactFilter,
    practicalityFilter,
    profileSyncKey,
    onSessionIssue,
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const response = await apiClient.refreshSustainableAlternatives({
        forceRefresh: true,
        ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
        ...(affordabilityFilter !== 'all' ? { affordability: affordabilityFilter } : {}),
        ...(relevanceFilter !== 'all' ? { relevance: relevanceFilter } : {}),
        ...(impactFilter !== 'all' ? { impactType: impactFilter } : {}),
        ...(practicalityFilter !== 'all' ? { practicality: practicalityFilter } : {}),
      });
      setAlternativesData(response);
      setSelectedComparison(response.featuredComparison);
    } catch (error) {
      onSessionIssue?.(error);
      setLoadError(formatWorkspaceError(error, 'Sustainable Alternatives Advisor'));
    } finally {
      setIsRefreshing(false);
    }
  }, [
    apiClient,
    categoryFilter,
    affordabilityFilter,
    relevanceFilter,
    impactFilter,
    practicalityFilter,
    onSessionIssue,
  ]);

  const handleCompare = useCallback(
    async (alternativeId: string, currentOption?: string) => {
      setIsComparing(true);
      setLoadError(null);
      try {
        const comparison = await apiClient.compareSustainableAlternative({
          alternativeId,
          ...(currentOption !== undefined ? { currentOption } : {}),
        });
        setSelectedComparison(comparison);
      } catch (error) {
        onSessionIssue?.(error);
        setLoadError(formatWorkspaceError(error, 'Sustainable Choice Comparison'));
      } finally {
        setIsComparing(false);
      }
    },
    [apiClient, onSessionIssue],
  );

  const handleResetFilters = useCallback(() => {
    setIsRefreshing(true);
    setCategoryFilter('all');
    setAffordabilityFilter('all');
    setRelevanceFilter('all');
    setImpactFilter('all');
    setPracticalityFilter('all');
  }, []);

  if (isLoading && !alternativesData) {
    return (
      <SurfaceCard as="section" aria-labelledby="alternatives-loading-heading">
        <output aria-live="polite" className="block space-y-2 text-sm text-slate-700">
          <p id="alternatives-loading-heading" className="font-semibold text-slate-950">
            Preparing Sustainable Alternatives Advisor...
          </p>
          <p>
            Evaluating practical transport, household energy, everyday habit, and waste choices for{' '}
            {profile.city}.
          </p>
        </output>
      </SurfaceCard>
    );
  }

  if (loadError && !alternativesData) {
    return (
      <AlertBanner tone="error" title="Sustainable Alternatives Advisor failed to load">
        <p>{loadError}</p>
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={() => void handleRefresh()}>
            Retry alternatives
          </Button>
        </div>
      </AlertBanner>
    );
  }

  if (!alternativesData) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="sustainable-alternatives-workspace">
      {loadError ? (
        <AlertBanner tone="error" title="Alternatives notice">
          <p>{loadError}</p>
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
        onSelectCategory={(val) => {
          setIsRefreshing(true);
          setCategoryFilter(val);
        }}
        onSelectAffordability={(val) => {
          setIsRefreshing(true);
          setAffordabilityFilter(val);
        }}
        onSelectRelevance={(val) => {
          setIsRefreshing(true);
          setRelevanceFilter(val);
        }}
        onSelectImpact={(val) => {
          setIsRefreshing(true);
          setImpactFilter(val);
        }}
        onSelectPracticality={(val) => {
          setIsRefreshing(true);
          setPracticalityFilter(val);
        }}
        onResetFilters={handleResetFilters}
        onRefresh={() => void handleRefresh()}
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
