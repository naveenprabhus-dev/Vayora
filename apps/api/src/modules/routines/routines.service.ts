import crypto from 'node:crypto';
import type {
  DailyRoutineResponse,
  HouseholdLifestyleRecord,
  RoutinesQueryInput,
  RoutinesRefreshInput,
} from '@uaqa/contracts';
import type { HouseholdRepository } from '../../repositories/household.repository.ts';
import { NotFoundError } from '../../utils/errors.ts';
import type { AirQualityService } from '../air-quality/air-quality.service.ts';
import { RoutinesCacheRepository } from './routines.cache.ts';
import { buildCommuteStrategy } from './utils/commute-advisor.ts';
import { selectBetterTimeWindows } from './utils/forecast-window-selector.ts';
import { evaluateAirQualityForRoutines } from './utils/routine-aq-evaluator.ts';
import { buildPersonalizedRoutinePeriods } from './utils/routine-rule-engine.ts';

export interface RoutinesServiceDependencies {
  readonly householdRepository: HouseholdRepository;
  readonly airQualityService: AirQualityService;
  readonly cacheRepository?: RoutinesCacheRepository;
}

function buildProfileFingerprint(
  ownerUid: string,
  profile: HouseholdLifestyleRecord,
  effectiveCommuteMode: HouseholdLifestyleRecord['primaryCommuteMode'],
  effectiveOutdoorPattern: HouseholdLifestyleRecord['outdoorActivityPattern'],
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
    savedCommute: profile.primaryCommuteMode,
    effectiveCommuteMode,
    savedOutdoor: profile.outdoorActivityPattern,
    effectiveOutdoorPattern,
    ventilation: profile.ventilationContext,
    purifier: profile.hasIndoorAirPurifier,
    heating: profile.heatingType,
    focus: profile.lifestylePreferences.preferredGuidanceFocus,
    airQualitySignature,
  });

  const digest = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  return `${ownerUid}::${digest}`;
}

export class RoutinesService {
  private readonly householdRepository: HouseholdRepository;
  private readonly airQualityService: AirQualityService;
  private readonly cacheRepository: RoutinesCacheRepository;

  public constructor(deps: RoutinesServiceDependencies) {
    this.householdRepository = deps.householdRepository;
    this.airQualityService = deps.airQualityService;
    this.cacheRepository = deps.cacheRepository ?? new RoutinesCacheRepository();
  }

  public async getDailyRoutines(
    ownerUid: string,
    query: RoutinesQueryInput = {},
    options?: { readonly forceRefresh?: boolean },
  ): Promise<DailyRoutineResponse> {
    const profile = await this.householdRepository.findByOwnerUid(ownerUid);
    if (!profile) {
      throw new NotFoundError(
        'Complete household onboarding before generating personalized daily routines.',
      );
    }

    const airQuality = await this.airQualityService.getCurrentAirQuality(ownerUid, { hours: 24 });

    const effectiveCommuteMode = query.commuteMode ?? profile.primaryCommuteMode;
    const effectiveOutdoorPattern = query.outdoorActivityPattern ?? profile.outdoorActivityPattern;
    const isScenarioPreview =
      effectiveCommuteMode !== profile.primaryCommuteMode ||
      effectiveOutdoorPattern !== profile.outdoorActivityPattern;

    const airQualitySignature = JSON.stringify({
      freshness: airQuality.transparency.freshnessStatus,
      availability: airQuality.transparency.availabilityStatus,
      observationTimestamp: airQuality.transparency.observationTimestamp,
      usAqi: airQuality.aqi.usAqi.value,
      europeanAqi: airQuality.aqi.europeanAqi.value,
      dominant: airQuality.aqi.dominantPollutant.code,
      forecastCount: airQuality.forecastPreview.length,
    });

    const cacheKey = buildProfileFingerprint(
      ownerUid,
      profile,
      effectiveCommuteMode,
      effectiveOutdoorPattern,
      airQualitySignature,
    );

    if (!options?.forceRefresh) {
      const cached = this.cacheRepository.getFresh(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const aqState = evaluateAirQualityForRoutines(airQuality);
    const betterTimeWindows = selectBetterTimeWindows({
      hourly: airQuality.forecastPreview,
      timezone: airQuality.location.timezone,
      transparency: airQuality.transparency,
    });

    const commuteSummary = buildCommuteStrategy({
      profile,
      effectiveCommuteMode,
      aqState,
      betterTimeWindows,
    });

    const { periods, overview } = buildPersonalizedRoutinePeriods({
      profile,
      effectiveCommuteMode,
      effectiveOutdoorPattern,
      aqState,
      betterTimeWindows,
    });

    const response: DailyRoutineResponse = {
      routineId: cacheKey,
      generatedAt: new Date().toISOString(),
      cachedResult: false,
      location: airQuality.location,
      profileContext: {
        primaryZoneType: profile.locationPreferences.primaryZoneType,
        householdSize: profile.householdSize,
        householdComposition: [...profile.householdComposition],
        savedCommuteMode: profile.primaryCommuteMode,
        effectiveCommuteMode,
        savedOutdoorPattern: profile.outdoorActivityPattern,
        effectiveOutdoorPattern,
        heatingType: profile.heatingType,
        ventilationContext: profile.ventilationContext,
        hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
        preferredGuidanceFocus: profile.lifestylePreferences.preferredGuidanceFocus,
        isScenarioPreview,
      },
      airQualityContext: {
        usAqi: airQuality.aqi.usAqi,
        europeanAqi: airQuality.aqi.europeanAqi,
        dominantPollutant: airQuality.aqi.dominantPollutant,
        pollutants: airQuality.pollutants,
        transparency: airQuality.transparency,
      },
      overview,
      betterTimeWindows,
      commuteSummary,
      periods,
    };

    this.cacheRepository.set(cacheKey, response);
    return response;
  }

  public async refreshDailyRoutines(
    ownerUid: string,
    body: RoutinesRefreshInput = {},
  ): Promise<DailyRoutineResponse> {
    if (body.forceRefresh) {
      this.cacheRepository.invalidateOwner(ownerUid);
    }

    const query: RoutinesQueryInput = {
      ...(body.commuteMode !== undefined ? { commuteMode: body.commuteMode } : {}),
      ...(body.outdoorActivityPattern !== undefined
        ? { outdoorActivityPattern: body.outdoorActivityPattern }
        : {}),
    };

    return this.getDailyRoutines(ownerUid, query, {
      forceRefresh: body.forceRefresh ?? true,
    });
  }
}
