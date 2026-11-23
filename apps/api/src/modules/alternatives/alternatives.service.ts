import crypto from 'node:crypto';
import type {
  AlternativeComparisonView,
  AlternativesCompareQueryInput,
  AlternativesQueryInput,
  AlternativesRefreshInput,
  HouseholdLifestyleRecord,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import type { HouseholdRepository } from '../../repositories/household.repository.ts';
import { NotFoundError } from '../../utils/errors.ts';
import type { AirQualityService } from '../air-quality/air-quality.service.ts';
import { evaluateAirQualityForRoutines } from '../routines/utils/routine-aq-evaluator.ts';
import { AlternativesCacheRepository } from './alternatives.cache.ts';
import {
  ALTERNATIVES_METHODOLOGICAL_PRINCIPLES,
  IMPACT_DISTINCTION_LEGEND,
} from './alternatives.constants.ts';
import {
  countByCategory,
  countByImpact,
  filterAlternatives,
  generateSustainableAlternativesCatalog,
} from './utils/alternatives-engine.ts';
import { buildAlternativeComparison } from './utils/comparison-engine.ts';

export interface AlternativesServiceDependencies {
  readonly householdRepository: HouseholdRepository;
  readonly airQualityService: AirQualityService;
  readonly cacheRepository?: AlternativesCacheRepository;
}

function buildAlternativesFingerprint(
  ownerUid: string,
  profile: HouseholdLifestyleRecord,
  query: AlternativesQueryInput,
  airQualitySignature: string,
): string {
  const payload = JSON.stringify({
    ownerUid,
    country: profile.country,
    city: profile.city,
    neighborhood: profile.neighborhood,
    postalPrefix: profile.postalPrefix,
    zone: profile.locationPreferences.primaryZoneType,
    size: profile.householdSize,
    composition: [...profile.householdComposition].sort(),
    commute: profile.primaryCommuteMode,
    outdoor: profile.outdoorActivityPattern,
    ventilation: profile.ventilationContext,
    purifier: profile.hasIndoorAirPurifier,
    heating: profile.heatingType,
    focus: profile.lifestylePreferences.preferredGuidanceFocus,
    query: {
      category: query.category ?? null,
      affordability: query.affordability ?? null,
      relevance: query.relevance ?? null,
      impactType: query.impactType ?? null,
      practicality: query.practicality ?? null,
    },
    airQualitySignature,
  });

  const digest = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  return `${ownerUid}::${digest}`;
}

export class SustainableAlternativesService {
  private readonly householdRepository: HouseholdRepository;
  private readonly airQualityService: AirQualityService;
  private readonly cacheRepository: AlternativesCacheRepository;

  public constructor(deps: AlternativesServiceDependencies) {
    this.householdRepository = deps.householdRepository;
    this.airQualityService = deps.airQualityService;
    this.cacheRepository = deps.cacheRepository ?? new AlternativesCacheRepository();
  }

  public async getRecommendations(
    ownerUid: string,
    query: AlternativesQueryInput = {},
    options?: { readonly forceRefresh?: boolean },
  ): Promise<SustainableAlternativesResponse> {
    const profile = await this.householdRepository.findByOwnerUid(ownerUid);
    if (!profile) {
      throw new NotFoundError(
        'Complete household onboarding before generating sustainable alternatives.',
      );
    }

    const airQuality = await this.airQualityService.getCurrentAirQuality(ownerUid, { hours: 24 });
    const airQualitySignature = JSON.stringify({
      freshness: airQuality.transparency.freshnessStatus,
      availability: airQuality.transparency.availabilityStatus,
      observationTimestamp: airQuality.transparency.observationTimestamp,
      usAqi: airQuality.aqi.usAqi.value,
      europeanAqi: airQuality.aqi.europeanAqi.value,
      dominant: airQuality.aqi.dominantPollutant.code,
    });

    const cacheKey = buildAlternativesFingerprint(ownerUid, profile, query, airQualitySignature);
    if (!options?.forceRefresh) {
      const cached = this.cacheRepository.getFresh(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const aqState = evaluateAirQualityForRoutines(airQuality);
    const fullCatalog = generateSustainableAlternativesCatalog({
      profile,
      aqState,
      location: airQuality.location,
    });
    const filteredAlternatives = filterAlternatives(fullCatalog, query);

    const activeTransportAqiNote = aqState.isUnavailable
      ? `Outdoor AQI telemetry is unavailable in ${airQuality.location.city}; active travel (walking/cycling) is kept conditional on local visibility and safety.`
      : aqState.isHighOrWorse
        ? `High pollution alert (${aqState.usAqiSnippet}): walking or cycling is NOT universally advised outdoors right now due to higher pollutant inhalation.`
        : aqState.isElevatedOrWorse
          ? `Moderate/elevated pollution (${aqState.usAqiSnippet}): active travel is marked conditional—prefer shorter trips on quiet side streets.`
          : `Favourable outdoor air (${aqState.usAqiSnippet}): short walking or cycling along safer routes is currently suitable.`;

    const featuredItem = filteredAlternatives[0] ?? null;
    const featuredComparison = featuredItem ? buildAlternativeComparison(featuredItem) : null;

    const response: SustainableAlternativesResponse = {
      advisoryId: cacheKey,
      generatedAt: new Date().toISOString(),
      cachedResult: false,
      location: airQuality.location,
      overview: {
        headline: `Sustainable Alternatives Advisor (${profile.city})`,
        summary:
          'Practical, affordable alternatives tailored to your commute, home heating, and current air quality—with strict separation between local emissions, personal exposure, and broader sustainability.',
        totalCatalogEvaluated: fullCatalog.length,
        matchedAlternativesCount: filteredAlternatives.length,
        countsByCategory: countByCategory(filteredAlternatives),
        countsByImpact: countByImpact(filteredAlternatives),
        householdSummary: {
          householdSize: profile.householdSize,
          householdComposition: [...profile.householdComposition],
          primaryCommuteMode: profile.primaryCommuteMode,
          heatingType: profile.heatingType,
          ventilationContext: profile.ventilationContext,
          primaryZoneType: profile.locationPreferences.primaryZoneType,
        },
        outdoorConditionSummary: aqState.aqContextSummary,
        impactDistinctionLegend: IMPACT_DISTINCTION_LEGEND,
        activeTransportAqiNote,
      },
      appliedFilters: {
        category: query.category ?? null,
        affordability: query.affordability ?? null,
        relevance: query.relevance ?? null,
        impactType: query.impactType ?? null,
        practicality: query.practicality ?? null,
      },
      airQualityContext: {
        usAqi: airQuality.aqi.usAqi,
        europeanAqi: airQuality.aqi.europeanAqi,
        dominantPollutant: airQuality.aqi.dominantPollutant,
        transparency: airQuality.transparency,
      },
      alternatives: filteredAlternatives,
      featuredComparison,
      provenanceAndDisclosures: {
        dataSources: [
          'Saved VAYORA Household Lifestyle Profile (commute mode, heating type, ventilation context, location zone)',
          airQuality.transparency.attribution,
          'Public-health & environmental guidance references (US EPA, WHO, EEA — cited individually per recommendation with scope limitations; no official endorsement implied)',
        ],
        methodologicalPrinciples: ALTERNATIVES_METHODOLOGICAL_PRINCIPLES,
        limitationsSummary:
          'Comparisons are qualitative and condition-aware. VAYORA does not invent percentage emission savings, household utility bill savings, or local municipal transit/subsidy availability.',
      },
    };

    this.cacheRepository.set(cacheKey, response);
    return response;
  }

  public async compareAlternative(
    ownerUid: string,
    query: AlternativesCompareQueryInput,
  ): Promise<AlternativeComparisonView> {
    const profile = await this.householdRepository.findByOwnerUid(ownerUid);
    if (!profile) {
      throw new NotFoundError(
        'Complete household onboarding before comparing sustainable alternatives.',
      );
    }

    const airQuality = await this.airQualityService.getCurrentAirQuality(ownerUid, { hours: 24 });
    const aqState = evaluateAirQualityForRoutines(airQuality);
    const catalog = generateSustainableAlternativesCatalog({
      profile,
      aqState,
      location: airQuality.location,
    });

    const match = catalog.find((item) => item.id === query.alternativeId);
    if (!match) {
      throw new NotFoundError(
        `No sustainable alternative found matching identifier "${query.alternativeId}" for your household profile.`,
      );
    }

    return buildAlternativeComparison(match, query.currentOption);
  }

  public async refreshRecommendations(
    ownerUid: string,
    body: AlternativesRefreshInput = {},
  ): Promise<SustainableAlternativesResponse> {
    if (body.forceRefresh ?? true) {
      this.cacheRepository.invalidateOwner(ownerUid);
    }

    const query: AlternativesQueryInput = {
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.affordability !== undefined ? { affordability: body.affordability } : {}),
      ...(body.relevance !== undefined ? { relevance: body.relevance } : {}),
      ...(body.impactType !== undefined ? { impactType: body.impactType } : {}),
      ...(body.practicality !== undefined ? { practicality: body.practicality } : {}),
    };

    return this.getRecommendations(ownerUid, query, {
      forceRefresh: body.forceRefresh ?? true,
    });
  }
}
