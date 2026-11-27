import type {
  AdvisoryExplanationFocus,
  AdvisorySourceModule,
  ChoiceComparisonExplanationResponse,
  PersonalizedBriefingResponse,
  WhyRecommendationResponse,
} from '@uaqa/contracts';
import { useCallback, useState } from 'react';
import type { WebApiClient } from '../lib/apiClient.ts';
import { formatWorkspaceError } from '../lib/errorMessages.ts';

export interface UseAdvisoryExplorerOptions {
  readonly apiClient: WebApiClient;
  readonly selectedFocus: AdvisoryExplanationFocus;
  readonly onSessionIssue?: ((error: unknown) => void) | undefined;
}

export function selectAlternativeOptions(
  briefing: PersonalizedBriefingResponse | null,
): PersonalizedBriefingResponse['availableRecommendations'] {
  return (briefing?.availableRecommendations ?? []).filter(
    (entry) => entry.sourceModule === 'alternatives',
  );
}

export function useAdvisoryExplorer({
  apiClient,
  selectedFocus,
  onSessionIssue,
}: UseAdvisoryExplorerOptions) {
  const [selectedRecId, setSelectedRecId] = useState('');
  const [selectedSourceModule, setSelectedSourceModule] =
    useState<AdvisorySourceModule>('routines');
  const [explanation, setExplanation] = useState<WhyRecommendationResponse | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const [selectedAlternativeId, setSelectedAlternativeId] = useState('');
  const [comparisonExplanation, setComparisonExplanation] =
    useState<ChoiceComparisonExplanationResponse | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

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

  const requestExplanationFor = useCallback(
    async (
      recommendationId: string,
      sourceModule: AdvisorySourceModule,
      focus: AdvisoryExplanationFocus = selectedFocus,
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
    [apiClient, onSessionIssue, selectedFocus],
  );

  const selectAndExplain = useCallback(
    (recommendationId: string, sourceModule: AdvisorySourceModule) => {
      setSelectedRecId(recommendationId);
      setSelectedSourceModule(sourceModule);
      void requestExplanationFor(recommendationId, sourceModule, selectedFocus);
    },
    [requestExplanationFor, selectedFocus],
  );

  const selectRecommendation = useCallback(
    (recommendationId: string, sourceModule: AdvisorySourceModule) => {
      setSelectedRecId(recommendationId);
      setSelectedSourceModule(sourceModule);
    },
    [],
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

  return {
    selectedRecId,
    selectedSourceModule,
    explanation,
    isExplaining,
    explainError,
    selectedAlternativeId,
    comparisonExplanation,
    isComparing,
    compareError,
    setSelectedAlternativeId,
    syncDefaultSelections,
    requestExplanationFor,
    selectAndExplain,
    selectRecommendation,
    handleCompareChoices,
  };
}
