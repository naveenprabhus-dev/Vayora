import { ServiceUnavailableError } from '../../../utils/errors.ts';
import {
  AIR_QUALITY_LIMITS,
  OPEN_METEO_CURRENT_VARIABLES,
  OPEN_METEO_HOURLY_VARIABLES,
  OPEN_METEO_PROVIDER_ID,
} from '../air-quality.constants.ts';
import {
  rawOpenMeteoAirQualityResponseSchema,
  rawOpenMeteoGeocodingResponseSchema,
  type RawOpenMeteoAirQualityResponse,
  type RawOpenMeteoGeocodingCandidate,
} from '../air-quality.schemas.ts';
import type { GeocodedCoordinateResult } from '../air-quality.types.ts';
import type {
  AirQualityFetchParams,
  AirQualityProvider,
  GeocodeLookupInput,
  GeocodingProvider,
} from './air-quality.provider.interface.ts';

export interface OpenMeteoProviderConfig {
  readonly airQualityBaseUrl: string;
  readonly geocodingBaseUrl: string;
  readonly timeoutMs: number;
  readonly fetchFn?: typeof fetch;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function waitMs(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function readBoundedJson(
  response: Response,
  maxBytes: number,
  upstreamLabel: string,
): Promise<unknown> {
  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new ServiceUnavailableError(`${upstreamLabel} response exceeded maximum allowed size.`);
    }
  }

  const rawText = await response.text();
  if (Buffer.byteLength(rawText, 'utf8') > maxBytes) {
    throw new ServiceUnavailableError(`${upstreamLabel} response exceeded maximum allowed size.`);
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    throw new ServiceUnavailableError(`${upstreamLabel} returned malformed JSON.`);
  }
}

async function fetchWithBoundedRetry(
  url: string,
  timeoutMs: number,
  fetchFn: typeof fetch,
  upstreamLabel: string,
): Promise<Response> {
  const maxAttempts = 1 + AIR_QUALITY_LIMITS.maxRetriesOnTransientFailure;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (response.ok) {
        return response;
      }

      if (isTransientStatus(response.status) && attempt < maxAttempts) {
        const jitter = Math.floor(Math.random() * 80);
        await waitMs(AIR_QUALITY_LIMITS.retryBaseDelayMs + jitter);
        continue;
      }

      throw new ServiceUnavailableError(`${upstreamLabel} returned status ${response.status}.`);
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        throw error;
      }
      if (attempt < maxAttempts) {
        const jitter = Math.floor(Math.random() * 80);
        await waitMs(AIR_QUALITY_LIMITS.retryBaseDelayMs + jitter);
        continue;
      }
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      throw new ServiceUnavailableError(
        isTimeout
          ? `${upstreamLabel} request timed out.`
          : `${upstreamLabel} could not be reached.`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw new ServiceUnavailableError(`${upstreamLabel} could not be reached.`);
}

function normalizeToken(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function scoreCandidate(
  candidate: RawOpenMeteoGeocodingCandidate,
  input: GeocodeLookupInput,
): number {
  const expectedCountry = normalizeToken(input.country);
  const expectedCity = normalizeToken(input.city);
  const expectedNeighborhood = normalizeToken(input.neighborhood);
  const expectedPostal = normalizeToken(input.postalPrefix).replace(/[\s-]/g, '');

  const candidateCountry = normalizeToken(candidate.country);
  const candidateCode = normalizeToken(candidate.country_code);
  const candidateName = normalizeToken(candidate.name);

  let score = 0;

  if (expectedCountry) {
    if (candidateCountry === expectedCountry || candidateCode === expectedCountry) {
      score += 50;
    } else if (
      candidateCountry.includes(expectedCountry) ||
      expectedCountry.includes(candidateCountry)
    ) {
      score += 30;
    } else {
      // Mismatched country disqualifies candidate
      return -1;
    }
  }

  if (candidateName === expectedCity) {
    score += 35;
  } else if (candidateName.includes(expectedCity) || expectedCity.includes(candidateName)) {
    score += 20;
  } else if (expectedNeighborhood && candidateName.includes(expectedNeighborhood)) {
    score += 15;
  }

  if (expectedPostal && candidate.postcodes && candidate.postcodes.length > 0) {
    const postalMatch = candidate.postcodes.some((code) =>
      normalizeToken(code).replace(/[\s-]/g, '').startsWith(expectedPostal),
    );
    if (postalMatch) {
      score += 20;
    }
  }

  return score;
}

export class OpenMeteoAirQualityProvider implements AirQualityProvider, GeocodingProvider {
  public readonly providerId = OPEN_METEO_PROVIDER_ID;
  private readonly airQualityBaseUrl: string;
  private readonly geocodingBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  public constructor(config: OpenMeteoProviderConfig) {
    this.airQualityBaseUrl = config.airQualityBaseUrl;
    this.geocodingBaseUrl = config.geocodingBaseUrl;
    this.timeoutMs = config.timeoutMs;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  public async fetchAirQuality(
    params: AirQualityFetchParams,
  ): Promise<RawOpenMeteoAirQualityResponse> {
    const url = new URL(this.airQualityBaseUrl);
    url.searchParams.set('latitude', String(params.latitude));
    url.searchParams.set('longitude', String(params.longitude));
    url.searchParams.set('current', OPEN_METEO_CURRENT_VARIABLES.join(','));
    url.searchParams.set('hourly', OPEN_METEO_HOURLY_VARIABLES.join(','));
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set(
      'forecast_days',
      String(params.forecastDays ?? AIR_QUALITY_LIMITS.maxForecastDays),
    );

    const response = await fetchWithBoundedRetry(
      url.toString(),
      this.timeoutMs,
      this.fetchFn,
      'Air quality data provider',
    );
    const json = await readBoundedJson(
      response,
      AIR_QUALITY_LIMITS.maxUpstreamPayloadBytes,
      'Air quality data provider',
    );

    const parsed = rawOpenMeteoAirQualityResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ServiceUnavailableError('Air quality data provider returned an invalid format.');
    }

    return parsed.data;
  }

  public async geocodeLocation(
    input: GeocodeLookupInput,
  ): Promise<GeocodedCoordinateResult | null> {
    const searchTerms = [input.city.trim()];
    if (
      input.neighborhood &&
      input.neighborhood.trim().length >= 2 &&
      normalizeToken(input.neighborhood) !== normalizeToken(input.city)
    ) {
      searchTerms.push(input.neighborhood.trim());
    }

    for (const term of searchTerms) {
      const url = new URL(this.geocodingBaseUrl);
      url.searchParams.set('name', term);
      url.searchParams.set('count', '8');
      url.searchParams.set('language', 'en');
      url.searchParams.set('format', 'json');

      const response = await fetchWithBoundedRetry(
        url.toString(),
        this.timeoutMs,
        this.fetchFn,
        'Location geocoding provider',
      );
      const json = await readBoundedJson(
        response,
        AIR_QUALITY_LIMITS.maxUpstreamPayloadBytes,
        'Location geocoding provider',
      );

      const parsed = rawOpenMeteoGeocodingResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new ServiceUnavailableError(
          'Location geocoding provider returned an invalid format.',
        );
      }

      const candidates = parsed.data.results ?? [];
      let bestCandidate: RawOpenMeteoGeocodingCandidate | null = null;
      let bestScore = -1;

      for (const candidate of candidates) {
        const score = scoreCandidate(candidate, input);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }

      if (bestCandidate && bestScore >= 0) {
        const areaParts = [bestCandidate.name, bestCandidate.admin1, bestCandidate.country].filter(
          (part): part is string => Boolean(part && part.trim().length > 0),
        );
        return {
          latitude: bestCandidate.latitude,
          longitude: bestCandidate.longitude,
          resolvedLabel: areaParts.join(', '),
          country: bestCandidate.country ?? input.country,
          timezone: bestCandidate.timezone ?? 'UTC',
        };
      }
    }

    return null;
  }

  public async checkAvailability(): Promise<boolean> {
    try {
      const url = new URL(this.airQualityBaseUrl);
      url.searchParams.set('latitude', '52.52');
      url.searchParams.set('longitude', '13.41');
      url.searchParams.set('current', 'us_aqi');
      const response = await fetchWithBoundedRetry(
        url.toString(),
        Math.min(this.timeoutMs, 3000),
        this.fetchFn,
        'Air quality data provider',
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
