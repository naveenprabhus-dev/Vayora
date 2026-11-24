import type {
  AdvisoryBriefingQueryInput,
  AdvisoryCompareBodyInput,
  AdvisoryExplainBodyInput,
  AdvisoryOperationalMetrics,
  AdvisoryRefreshBodyInput,
  AirQualityCurrentResponse,
  AirQualityForecastResponse,
  AirQualityGuidanceResponse,
  AirQualityHealthResponse,
  AirQualityLocationUpdateResponse,
  AirQualityPollutantsResponse,
  AlternativeComparisonView,
  AlternativesCompareQueryInput,
  AlternativesQueryInput,
  AlternativesRefreshInput,
  ApiErrorResponse,
  ApiResponse,
  AqiScaleId,
  AuthenticatedPrincipal,
  ChoiceComparisonExplanationResponse,
  DailyRoutineResponse,
  HealthStatusPayload,
  HouseholdLifestyleInput,
  HouseholdLifestyleRecord,
  IndoorAirGuidanceResponse,
  IndoorGuidanceQueryInput,
  IndoorGuidanceRefreshInput,
  LocationUpdateInput,
  PersonalizedBriefingResponse,
  RoutinesQueryInput,
  RoutinesRefreshInput,
  SustainableAlternativesResponse,
  WhyRecommendationResponse,
} from '@uaqa/contracts';
import { getPublicWebEnv } from './env.ts';

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly requestId: string;

  public constructor(options: {
    message: string;
    statusCode: number;
    code: string;
    requestId: string;
  }) {
    super(options.message);
    this.name = 'ApiClientError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

export interface ApiClientOptions {
  readonly baseUrl?: string;
  readonly getAccessToken?: () => Promise<string | null>;
}

export interface SessionPayload {
  readonly authenticated: true;
  readonly principal: AuthenticatedPrincipal;
}

export interface PasswordResetAckPayload {
  readonly accepted: boolean;
  readonly message: string;
}

export interface HouseholdProfileEnvelope {
  readonly profile: HouseholdLifestyleRecord & {
    readonly id?: string;
    readonly createdAt?: string;
    readonly updatedAt?: string;
  };
}

export interface AirQualityRequestOptions {
  readonly latitude?: number;
  readonly longitude?: number;
  readonly hours?: number;
  readonly scale?: AqiScaleId;
}

function buildAirQualityQueryString(query?: AirQualityRequestOptions): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  if (query.latitude !== undefined && query.longitude !== undefined) {
    params.set('latitude', String(query.latitude));
    params.set('longitude', String(query.longitude));
  }
  if (query.hours !== undefined) {
    params.set('hours', String(query.hours));
  }
  if (query.scale !== undefined) {
    params.set('scale', query.scale);
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function buildRoutinesQueryString(query?: RoutinesQueryInput): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  if (query.date) {
    params.set('date', query.date);
  }
  if (query.commuteMode) {
    params.set('commuteMode', query.commuteMode);
  }
  if (query.outdoorActivityPattern) {
    params.set('outdoorActivityPattern', query.outdoorActivityPattern);
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function buildIndoorQueryString(query?: IndoorGuidanceQueryInput): string {
  if (!query?.scenario) {
    return '';
  }
  const params = new URLSearchParams();
  params.set('scenario', query.scenario);
  return `?${params.toString()}`;
}

function buildAlternativesQueryString(query?: AlternativesQueryInput): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  if (query.category) {
    params.set('category', query.category);
  }
  if (query.affordability) {
    params.set('affordability', query.affordability);
  }
  if (query.relevance) {
    params.set('relevance', query.relevance);
  }
  if (query.impactType) {
    params.set('impactType', query.impactType);
  }
  if (query.practicality) {
    params.set('practicality', query.practicality);
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function buildAlternativesCompareQueryString(query: AlternativesCompareQueryInput): string {
  const params = new URLSearchParams();
  params.set('alternativeId', query.alternativeId);
  if (query.currentOption) {
    params.set('currentOption', query.currentOption);
  }
  return `?${params.toString()}`;
}

function buildAdvisoryBriefingQueryString(query?: AdvisoryBriefingQueryInput): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  if (query.focus) {
    params.set('focus', query.focus);
  }
  if (query.forceRefresh) {
    params.set('forceRefresh', 'true');
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? getPublicWebEnv().apiBaseUrl;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (options.getAccessToken) {
      const token = await options.getAccessToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });

    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success) {
      const errBody = payload as ApiErrorResponse;
      throw new ApiClientError({
        message: errBody.error?.message ?? `Request failed with status ${response.status}.`,
        statusCode: response.status,
        code: errBody.error?.code ?? 'INTERNAL_ERROR',
        requestId: errBody.meta?.requestId ?? 'unknown',
      });
    }

    return payload.data;
  }

  return {
    getHealth: (signal?: AbortSignal) =>
      request<HealthStatusPayload>('/health', signal ? { signal } : {}),
    getAuthSession: () => request<SessionPayload>('/auth/session'),
    verifyToken: () =>
      request<{ readonly verified: true; readonly principal: AuthenticatedPrincipal }>(
        '/auth/verify-token',
        { method: 'POST' },
      ),
    requestPasswordResetAudit: (email: string) =>
      request<PasswordResetAckPayload>('/auth/password-reset-request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    getHouseholdProfile: () => request<HouseholdProfileEnvelope>('/household/profile'),
    saveHouseholdProfile: (input: HouseholdLifestyleInput) =>
      request<HouseholdProfileEnvelope>('/household/profile', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    validateHouseholdProfile: (input: HouseholdLifestyleInput) =>
      request<{ readonly valid: true; readonly ownerUid: string }>('/household/validate', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    getAirQualityCurrent: (query?: AirQualityRequestOptions) =>
      request<AirQualityCurrentResponse>(
        `/air-quality/current${buildAirQualityQueryString(query)}`,
      ),
    getAirQualityForecast: (query?: AirQualityRequestOptions) =>
      request<AirQualityForecastResponse>(
        `/air-quality/forecast${buildAirQualityQueryString(query)}`,
      ),
    getAirQualityPollutants: (query?: AirQualityRequestOptions) =>
      request<AirQualityPollutantsResponse>(
        `/air-quality/pollutants${buildAirQualityQueryString(query)}`,
      ),
    getAirQualityGuidance: (query?: AirQualityRequestOptions) =>
      request<AirQualityGuidanceResponse>(
        `/air-quality/guidance${buildAirQualityQueryString(query)}`,
      ),
    getAirQualityHealth: () => request<AirQualityHealthResponse>('/air-quality/health'),
    updateAirQualityLocation: (input: LocationUpdateInput) =>
      request<AirQualityLocationUpdateResponse>('/air-quality/location', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    getDailyRoutines: (query?: RoutinesQueryInput) =>
      request<DailyRoutineResponse>(`/routines/daily${buildRoutinesQueryString(query)}`),
    refreshDailyRoutines: (input: RoutinesRefreshInput = { forceRefresh: true }) =>
      request<DailyRoutineResponse>('/routines/refresh', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    getIndoorAirGuidance: (query?: IndoorGuidanceQueryInput) =>
      request<IndoorAirGuidanceResponse>(`/indoor-air/guidance${buildIndoorQueryString(query)}`),
    refreshIndoorAirGuidance: (input: IndoorGuidanceRefreshInput = { forceRefresh: true }) =>
      request<IndoorAirGuidanceResponse>('/indoor-air/refresh', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    getSustainableAlternatives: (query?: AlternativesQueryInput) =>
      request<SustainableAlternativesResponse>(
        `/alternatives/recommendations${buildAlternativesQueryString(query)}`,
      ),
    compareSustainableAlternative: (query: AlternativesCompareQueryInput) =>
      request<AlternativeComparisonView>(
        `/alternatives/compare${buildAlternativesCompareQueryString(query)}`,
      ),
    refreshSustainableAlternatives: (input: AlternativesRefreshInput = { forceRefresh: true }) =>
      request<SustainableAlternativesResponse>('/alternatives/refresh', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    getPersonalizedBriefing: (query?: AdvisoryBriefingQueryInput) =>
      request<PersonalizedBriefingResponse>(
        `/advisory/briefing${buildAdvisoryBriefingQueryString(query)}`,
      ),
    explainRecommendation: (input: AdvisoryExplainBodyInput) =>
      request<WhyRecommendationResponse>('/advisory/explain-recommendation', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    compareChoicesExplanation: (input: AdvisoryCompareBodyInput) =>
      request<ChoiceComparisonExplanationResponse>('/advisory/compare-choices', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    refreshPersonalizedAdvisory: (input: AdvisoryRefreshBodyInput = { forceRefresh: true }) =>
      request<PersonalizedBriefingResponse>('/advisory/refresh', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    getAdvisoryMetrics: () => request<AdvisoryOperationalMetrics>('/advisory/metrics'),
  };
}

export type WebApiClient = ReturnType<typeof createApiClient>;
