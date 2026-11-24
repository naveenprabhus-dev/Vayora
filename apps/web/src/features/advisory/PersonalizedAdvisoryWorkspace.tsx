import type {
  AdvisoryExplanationFocus,
  AdvisorySourceModule,
  ChoiceComparisonExplanationResponse,
  HouseholdLifestyleRecord,
  PersonalizedBriefingResponse,
  WhyRecommendationResponse,
} from '@uaqa/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import { formatWorkspaceError } from '../../lib/errorMessages.ts';
import { ChoiceComparisonExplainerPanel } from './ChoiceComparisonExplainerPanel.tsx';
import { DailyBriefingPanel } from './DailyBriefingPanel.tsx';
import { RecommendationExplainerPanel } from './RecommendationExplainerPanel.tsx';

export interface PersonalizedAdvisoryWorkspaceProps {
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly airQualitySyncToken?: string | undefined;
  readonly onSessionIssue?: (error: unknown) => void;
}

export function PersonalizedAdvisoryWorkspace({
  profile,
  apiClient,
  airQualitySyncToken,
  onSessionIssue,
}: PersonalizedAdvisoryWorkspaceProps) {
  const [briefing, setBriefing] = useState<PersonalizedBriefingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedRecId, setSelectedRecId] = useState<string>('');
  const [selectedSourceModule, setSelectedSourceModule] =
    useState<AdvisorySourceModule>('routines');
  const [selectedFocus, setSelectedFocus] = useState<AdvisoryExplanationFocus>('balanced');
  const [explanation, setExplanation] = useState<WhyRecommendationResponse | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>('');
  const [comparisonExplanation, setComparisonExplanation] =
    useState<ChoiceComparisonExplanationResponse | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const alternativeOptions = useMemo(
    () =>
      (briefing?.availableRecommendations ?? []).filter(
        (entry) => entry.sourceModule === 'alternatives',
      ),
    [briefing],
  );

  const syncDefaultSelections = useCallback((nextBriefing: PersonalizedBriefingResponse) => {
    const firstPriority =
      nextBriefing.priorityActions[0] ?? nextBriefing.availableRecommendations[0];
    if (firstPriority) {
      setSelectedRecId(firstPriority.recommendationId);
      setSelectedSourceModule(firstPriority.sourceModule);
    }
    const firstAlt = nextBriefing.availableRecommendations.find(
      (entry) => entry.sourceModule === 'alternatives',
    );
    if (firstAlt) {
      setSelectedAlternativeId(firstAlt.recommendationId);
    }
    setExplanation(null);
    setComparisonExplanation(null);
    setExplainError(null);
    setCompareError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBriefing() {
      setLoadError(null);
      try {
        const response = await apiClient.getPersonalizedBriefing({ focus: selectedFocus });
        if (!cancelled) {
          setBriefing(response);
          syncDefaultSelections(response);
        }
      } catch (error) {
        if (!cancelled) {
          onSessionIssue?.(error);
          setLoadError(formatWorkspaceError(error, 'Personalized Daily Briefing'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    if (profile.country && profile.city && airQualitySyncToken !== '__never__') {
      void loadBriefing();
    }

    return () => {
      cancelled = true;
    };
  }, [
    apiClient,
    airQualitySyncToken,
    profile.country,
    profile.city,
    profile.neighborhood,
    profile.postalPrefix,
    profile.primaryCommuteMode,
    profile.outdoorActivityPattern,
    profile.ventilationContext,
    profile.hasIndoorAirPurifier,
    profile.heatingType,
    profile.householdSize,
    profile.householdComposition,
    profile.lifestylePreferences.preferredGuidanceFocus,
    selectedFocus,
    syncDefaultSelections,
    onSessionIssue,
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const response = await apiClient.refreshPersonalizedAdvisory({
        focus: selectedFocus,
        forceRefresh: true,
      });
      setBriefing(response);
      syncDefaultSelections(response);
    } catch (error) {
      onSessionIssue?.(error);
      setLoadError(formatWorkspaceError(error, 'Personalized Daily Briefing'));
    } finally {
      setIsRefreshing(false);
    }
  }, [apiClient, onSessionIssue, selectedFocus, syncDefaultSelections]);

  const requestExplanationFor = useCallback(
    async (
      recommendationId: string,
      sourceModule: AdvisorySourceModule,
      focus: AdvisoryExplanationFocus,
    ) => {
      if (!recommendationId) {
        return;
      }
      setIsExplaining(true);
      setExplainError(null);
      try {
        const result = await apiClient.explainRecommendation({
          recommendationId,
          sourceModule,
          focus,
        });
        setExplanation(result);
      } catch (error) {
        onSessionIssue?.(error);
        setExplainError(formatWorkspaceError(error, 'Recommendation Explanation'));
      } finally {
        setIsExplaining(false);
      }
    },
    [apiClient, onSessionIssue],
  );

  const handleInspectRecommendation = useCallback(
    (recommendationId: string, sourceModule: AdvisorySourceModule) => {
      setSelectedRecId(recommendationId);
      setSelectedSourceModule(sourceModule);
      void requestExplanationFor(recommendationId, sourceModule, selectedFocus);
    },
    [requestExplanationFor, selectedFocus],
  );

  const handleCompareChoices = useCallback(async () => {
    if (!selectedAlternativeId) {
      return;
    }
    setIsComparing(true);
    setCompareError(null);
    try {
      const result = await apiClient.compareChoicesExplanation({
        alternativeId: selectedAlternativeId,
        focus: selectedFocus,
      });
      setComparisonExplanation(result);
    } catch (error) {
      onSessionIssue?.(error);
      setCompareError(formatWorkspaceError(error, 'Choice Comparison Explainer'));
    } finally {
      setIsComparing(false);
    }
  }, [apiClient, onSessionIssue, selectedAlternativeId, selectedFocus]);

  if (isLoading && !briefing) {
    return (
      <SurfaceCard as="section" aria-labelledby="advisory-loading-heading">
        <output aria-live="polite" className="block space-y-2 text-sm text-slate-700">
          <p id="advisory-loading-heading" className="font-semibold text-slate-950">
            Preparing Personalized Daily Briefing...
          </p>
          <p>
            Synthesizing grounded explanations across your routines, indoor setup, and sustainable
            alternatives for {profile.city}.
          </p>
        </output>
      </SurfaceCard>
    );
  }

  if (loadError && !briefing) {
    return (
      <AlertBanner tone="error" title="Personalized Briefing unavailable">
        <p>{loadError}</p>
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={() => void handleRefresh()}>
            Retry briefing
          </Button>
        </div>
      </AlertBanner>
    );
  }

  if (!briefing) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="personalized-advisory-workspace">
      {loadError ? (
        <AlertBanner tone="error" title="Personalized advisory notice">
          <p>{loadError}</p>
        </AlertBanner>
      ) : null}

      <DailyBriefingPanel
        briefing={briefing}
        isRefreshing={isRefreshing}
        selectedRecommendationId={explanation?.recommendation.recommendationId ?? null}
        onRefresh={() => void handleRefresh()}
        onInspectRecommendation={handleInspectRecommendation}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <RecommendationExplainerPanel
          recommendations={briefing.availableRecommendations}
          selectedRecommendationId={selectedRecId}
          selectedSourceModule={selectedSourceModule}
          selectedFocus={selectedFocus}
          explanation={explanation}
          isExplaining={isExplaining}
          explainError={explainError}
          onSelectRecommendation={(id, mod) => {
            setSelectedRecId(id);
            setSelectedSourceModule(mod);
          }}
          onSelectFocus={(focus) => setSelectedFocus(focus)}
          onRequestExplanation={() =>
            void requestExplanationFor(selectedRecId, selectedSourceModule, selectedFocus)
          }
        />

        <ChoiceComparisonExplainerPanel
          alternativeOptions={alternativeOptions}
          selectedAlternativeId={selectedAlternativeId}
          comparisonExplanation={comparisonExplanation}
          isComparing={isComparing}
          compareError={compareError}
          onSelectAlternativeId={setSelectedAlternativeId}
          onRequestComparison={() => void handleCompareChoices()}
        />
      </div>
    </div>
  );
}
