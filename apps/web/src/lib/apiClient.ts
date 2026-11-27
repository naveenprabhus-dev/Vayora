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
  readonly forceRefresh?: boolean;
}

type QueryParamValue = string | number | boolean | undefined;

function buildQueryString(entries: Readonly<Record<string, QueryParamValue>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function buildAirQualityQueryString(query?: AirQualityRequestOptions): string {
  if (!query) {
    return '';
  }
  const hasCoords = query.latitude !== undefined && query.longitude !== undefined;
  return buildQueryString({
    latitude: hasCoords ? query.latitude : undefined,
    longitude: hasCoords ? query.longitude : undefined,
    hours: query.hours,
    scale: query.scale,
  });
}

function buildRoutinesQueryString(query?: RoutinesQueryInput): string {
  return query
    ? buildQueryString({
        date: query.date,
        commuteMode: query.commuteMode,
        outdoorActivityPattern: query.outdoorActivityPattern,
      })
    : '';
}

function buildIndoorQueryString(query?: IndoorGuidanceQueryInput): string {
  return buildQueryString({ scenario: query?.scenario });
}

function buildAlternativesQueryString(query?: AlternativesQueryInput): string {
  return query
    ? buildQueryString({
        category: query.category,
        affordability: query.affordability,
        relevance: query.relevance,
        impactType: query.impactType,
        practicality: query.practicality,
      })
    : '';
}

function buildAlternativesCompareQueryString(query: AlternativesCompareQueryInput): string {
  return buildQueryString({
    alternativeId: query.alternativeId,
    currentOption: query.currentOption,
  });
}

function buildAdvisoryBriefingQueryString(query?: AdvisoryBriefingQueryInput): string {
  return query
    ? buildQueryString({
        focus: query.focus,
        forceRefresh: query.forceRefresh ? 'true' : undefined,
      })
    : '';
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

    let payload: ApiResponse<T> | null = null;
    try {
      payload = (await response.json()) as ApiResponse<T>;
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.success) {
      const errBody = payload as ApiErrorResponse | null;
      throw new ApiClientError({
        message: errBody?.error?.message ?? `Request failed with status ${response.status}.`,
        statusCode: response.status,
        code: errBody?.error?.code ?? 'INTERNAL_ERROR',
        requestId: errBody?.meta?.requestId ?? 'unknown',
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
