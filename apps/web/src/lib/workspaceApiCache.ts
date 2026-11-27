import type {
  AdvisoryBriefingQueryInput,
  AdvisoryRefreshBodyInput,
  AirQualityCurrentResponse,
  AlternativesQueryInput,
  AlternativesRefreshInput,
  DailyRoutineResponse,
  HouseholdLifestyleInput,
  IndoorAirGuidanceResponse,
  IndoorGuidanceQueryInput,
  IndoorGuidanceRefreshInput,
  LocationUpdateInput,
  PersonalizedBriefingResponse,
  RoutinesQueryInput,
  RoutinesRefreshInput,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import type { AirQualityRequestOptions, WebApiClient } from './apiClient.ts';

export interface WorkspaceCachedApiClient extends WebApiClient {
  readonly invalidateWorkspaceCache: () => void;
}

function serializeKey(prefix: string, input: unknown): string {
  if (!input || typeof input !== 'object') {
    return `${prefix}:default`;
  }
  const entries = Object.entries(input as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0 ? `${prefix}:default` : `${prefix}:${JSON.stringify(entries)}`;
}

function pickDefined<T extends object>(source: T | undefined, keys: readonly (keyof T)[]): Partial<T> {
  if (!source) {
    return {};
  }
  const result: Partial<T> = {};
  for (const key of keys) {
    if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Wraps a WebApiClient with session-scoped response caching and in-flight
 * deduplication so Overview and dedicated module pages share fetched results
 * without redundant network round-trips, while invalidating on mutations.
 */
export function createCachedWorkspaceApiClient(baseClient: WebApiClient): WorkspaceCachedApiClient {
  const airQualityCurrentCache = new Map<string, Promise<AirQualityCurrentResponse>>();
  const routinesCache = new Map<string, Promise<DailyRoutineResponse>>();
  const indoorCache = new Map<string, Promise<IndoorAirGuidanceResponse>>();
  const alternativesCache = new Map<string, Promise<SustainableAlternativesResponse>>();
  const briefingCache = new Map<string, Promise<PersonalizedBriefingResponse>>();

  function invalidateWorkspaceCache(): void {
    airQualityCurrentCache.clear();
    routinesCache.clear();
    indoorCache.clear();
    alternativesCache.clear();
    briefingCache.clear();
  }

  function invalidateAdvisoryAndDerivedModules(): void {
    routinesCache.clear();
    indoorCache.clear();
    alternativesCache.clear();
    briefingCache.clear();
  }

  function cachedCall<T>(
    cache: Map<string, Promise<T>>,
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    const existing = cache.get(key);
    if (existing) {
      return existing;
    }
    const promise = loader().catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, promise);
    return promise;
  }

  return {
    getHealth: (signal?: AbortSignal) => baseClient.getHealth(signal),
    getAuthSession: () => baseClient.getAuthSession(),
    verifyToken: () => baseClient.verifyToken(),
    requestPasswordResetAudit: (email: string) => baseClient.requestPasswordResetAudit(email),
    getHouseholdProfile: () => baseClient.getHouseholdProfile(),
    validateHouseholdProfile: (input: HouseholdLifestyleInput) =>
      baseClient.validateHouseholdProfile(input),

    async saveHouseholdProfile(input: HouseholdLifestyleInput) {
      const result = await baseClient.saveHouseholdProfile(input);
      invalidateWorkspaceCache();
      return result;
    },

    async updateAirQualityLocation(input: LocationUpdateInput) {
      const result = await baseClient.updateAirQualityLocation(input);
      invalidateWorkspaceCache();
      return result;
    },

    getAirQualityCurrent(query?: AirQualityRequestOptions) {
      const { forceRefresh, ...requestQuery } = query ?? {};
      const normalizedQuery = Object.keys(requestQuery).length > 0 ? requestQuery : undefined;
      const key = serializeKey('aq', normalizedQuery ?? { hours: 24 });
      if (forceRefresh) {
        airQualityCurrentCache.delete(key);
      }
      return cachedCall(airQualityCurrentCache, key, () =>
        baseClient.getAirQualityCurrent(normalizedQuery),
      );
    },

    getAirQualityForecast: (query?: AirQualityRequestOptions) =>
      baseClient.getAirQualityForecast(query),
    getAirQualityPollutants: (query?: AirQualityRequestOptions) =>
      baseClient.getAirQualityPollutants(query),
    getAirQualityGuidance: (query?: AirQualityRequestOptions) =>
      baseClient.getAirQualityGuidance(query),
    getAirQualityHealth: () => baseClient.getAirQualityHealth(),

    getDailyRoutines(query?: RoutinesQueryInput) {
      const key = serializeKey('routines', query);
      return cachedCall(routinesCache, key, () => baseClient.getDailyRoutines(query));
    },

    async refreshDailyRoutines(input?: RoutinesRefreshInput) {
      routinesCache.clear();
      const refreshed = await baseClient.refreshDailyRoutines(input);
      const key = serializeKey(
        'routines',
        pickDefined(input, ['commuteMode', 'outdoorActivityPattern']),
      );
      routinesCache.set(key, Promise.resolve(refreshed));
      return refreshed;
    },

    getIndoorAirGuidance(query?: IndoorGuidanceQueryInput) {
      const key = serializeKey('indoor', query);
      return cachedCall(indoorCache, key, () => baseClient.getIndoorAirGuidance(query));
    },

    async refreshIndoorAirGuidance(input?: IndoorGuidanceRefreshInput) {
      indoorCache.clear();
      const refreshed = await baseClient.refreshIndoorAirGuidance(input);
      const key = serializeKey(
        'indoor',
        input?.scenario && input.scenario !== 'baseline' ? { scenario: input.scenario } : undefined,
      );
      indoorCache.set(key, Promise.resolve(refreshed));
      return refreshed;
    },

    getSustainableAlternatives(query?: AlternativesQueryInput) {
      const key = serializeKey('alternatives', query);
      return cachedCall(alternativesCache, key, () => baseClient.getSustainableAlternatives(query));
    },

    compareSustainableAlternative: (query) => baseClient.compareSustainableAlternative(query),

    async refreshSustainableAlternatives(input?: AlternativesRefreshInput) {
      alternativesCache.clear();
      const refreshed = await baseClient.refreshSustainableAlternatives(input);
      const key = serializeKey(
        'alternatives',
        pickDefined(input, ['category', 'affordability', 'relevance', 'impactType', 'practicality']),
      );
      alternativesCache.set(key, Promise.resolve(refreshed));
      return refreshed;
    },

    getPersonalizedBriefing(query?: AdvisoryBriefingQueryInput) {
      if (query?.forceRefresh) {
        briefingCache.clear();
      }
      const key = serializeKey('briefing', { focus: query?.focus ?? 'balanced' });
      return cachedCall(briefingCache, key, () => baseClient.getPersonalizedBriefing(query));
    },

    explainRecommendation: (input) => baseClient.explainRecommendation(input),
    compareChoicesExplanation: (input) => baseClient.compareChoicesExplanation(input),

    async refreshPersonalizedAdvisory(input?: AdvisoryRefreshBodyInput) {
      invalidateAdvisoryAndDerivedModules();
      const refreshed = await baseClient.refreshPersonalizedAdvisory(input);
      const key = serializeKey('briefing', { focus: input?.focus ?? 'balanced' });
      briefingCache.set(key, Promise.resolve(refreshed));
      return refreshed;
    },

    getAdvisoryMetrics: () => baseClient.getAdvisoryMetrics(),
    invalidateWorkspaceCache,
  };
}
