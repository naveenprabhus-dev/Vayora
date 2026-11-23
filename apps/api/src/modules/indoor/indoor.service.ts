import crypto from 'node:crypto';
import type {
  HouseholdLifestyleRecord,
  IndoorAirGuidanceResponse,
  IndoorGuidanceQueryInput,
  IndoorGuidanceRefreshInput,
  IndoorScenarioId,
} from '@uaqa/contracts';
import type { HouseholdRepository } from '../../repositories/household.repository.ts';
import { NotFoundError } from '../../utils/errors.ts';
import type { AirQualityService } from '../air-quality/air-quality.service.ts';
import { selectBetterTimeWindows } from '../routines/utils/forecast-window-selector.ts';
import { evaluateAirQualityForRoutines } from '../routines/utils/routine-aq-evaluator.ts';
import { IndoorCacheRepository } from './indoor.cache.ts';
import { INDOOR_NON_MEDICAL_NOTICE, MANDATORY_NO_SENSOR_DISCLOSURE } from './indoor.constants.ts';
import {
  buildPersonalizedIndoorActionPlan,
  buildScenarioSummary,
} from './utils/indoor-action-plan.ts';
import { getCommonIndoorPollutionSources } from './utils/pollution-sources-guide.ts';
import { buildAirPurifierGuidance } from './utils/purifier-advisor.ts';
import { buildVentilationGuidance } from './utils/ventilation-engine.ts';

export interface IndoorServiceDependencies {
  readonly householdRepository: HouseholdRepository;
  readonly airQualityService: AirQualityService;
  readonly cacheRepository?: IndoorCacheRepository;
}

function buildIndoorFingerprint(
  ownerUid: string,
  profile: HouseholdLifestyleRecord,
  scenario: IndoorScenarioId,
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
    ventilation: profile.ventilationContext,
    purifier: profile.hasIndoorAirPurifier,
    heating: profile.heatingType,
    focus: profile.lifestylePreferences.preferredGuidanceFocus,
    scenario,
    airQualitySignature,
  });

  const digest = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  return `${ownerUid}::${digest}`;
}

export class IndoorAirService {
  private readonly householdRepository: HouseholdRepository;
  private readonly airQualityService: AirQualityService;
  private readonly cacheRepository: IndoorCacheRepository;

  public constructor(deps: IndoorServiceDependencies) {
    this.householdRepository = deps.householdRepository;
    this.airQualityService = deps.airQualityService;
    this.cacheRepository = deps.cacheRepository ?? new IndoorCacheRepository();
  }

  public async getIndoorAirGuidance(
    ownerUid: string,
    query: IndoorGuidanceQueryInput = {},
    options?: { readonly forceRefresh?: boolean },
  ): Promise<IndoorAirGuidanceResponse> {
    const profile = await this.householdRepository.findByOwnerUid(ownerUid);
    if (!profile) {
      throw new NotFoundError(
        'Complete household onboarding before generating indoor air quality guidance.',
      );
    }

    const airQuality = await this.airQualityService.getCurrentAirQuality(ownerUid, { hours: 24 });
    const scenario: IndoorScenarioId = query.scenario ?? 'baseline';

    const airQualitySignature = JSON.stringify({
      freshness: airQuality.transparency.freshnessStatus,
      availability: airQuality.transparency.availabilityStatus,
      observationTimestamp: airQuality.transparency.observationTimestamp,
      usAqi: airQuality.aqi.usAqi.value,
      europeanAqi: airQuality.aqi.europeanAqi.value,
      dominant: airQuality.aqi.dominantPollutant.code,
      forecastCount: airQuality.forecastPreview.length,
    });

    const cacheKey = buildIndoorFingerprint(ownerUid, profile, scenario, airQualitySignature);
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

    const ventilationGuidance = buildVentilationGuidance({
      profile,
      aqState,
      betterTimeWindows,
      scenario,
    });

    const purifierGuidance = buildAirPurifierGuidance({
      profile,
      aqState,
      scenario,
    });

    const actionPlan = buildPersonalizedIndoorActionPlan({
      profile,
      aqState,
      betterTimeWindows,
      scenario,
    });

    const scenarioContext = buildScenarioSummary(scenario);
    const pollutionSources = getCommonIndoorPollutionSources();

    const response: IndoorAirGuidanceResponse = {
      guidanceId: cacheKey,
      generatedAt: new Date().toISOString(),
      cachedResult: false,
      location: airQuality.location,
      overview: {
        headline: `Indoor Air Quality Assistant (${profile.city})`,
        summary:
          'Tailored indoor ventilation, filtration, and source-control guidance derived from your household setup and available outdoor telemetry.',
        householdSize: profile.householdSize,
        householdComposition: [...profile.householdComposition],
        ventilationContext: profile.ventilationContext,
        hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
        heatingType: profile.heatingType,
        primaryZoneType: profile.locationPreferences.primaryZoneType,
        outdoorConditionSummary: aqState.aqContextSummary,
        sensorStatus: {
          sensorConnected: false,
          disclosureStatement: MANDATORY_NO_SENSOR_DISCLOSURE,
          evidenceDistinctions: [
            {
              category: 'measured_indoor',
              label: 'Measured indoor air quality',
              statusLabel: 'Not measured (no indoor sensors connected)',
              description:
                'No indoor PM2.5, PM10, CO2, CO, or VOC sensor readings exist. VAYORA never fabricates indoor numbers.',
            },
            {
              category: 'outdoor_air_quality',
              label: 'Outdoor air-quality information',
              statusLabel: aqState.isUnavailable
                ? 'Unavailable'
                : aqState.isStale
                  ? 'Stale cached model data'
                  : 'Fresh Open-Meteo model forecast',
              description: aqState.aqContextSummary,
            },
            {
              category: 'estimated_inferred_indoor',
              label: 'Estimated or inferred indoor conditions',
              statusLabel: 'Qualitative setup inference only',
              description: `Inferred qualitatively from saved ventilation (${profile.ventilationContext.replaceAll('_', ' ')}), purifier availability (${profile.hasIndoorAirPurifier ? 'yes' : 'no'}), and heating (${profile.heatingType.replaceAll('_', ' ')}).`,
            },
            {
              category: 'general_educational_guidance',
              label: 'General educational guidance',
              statusLabel: 'Public-health hygiene & safety principles',
              description:
                'Source-control steps, appliance maintenance, and chemical safety boundaries grounded in general environmental health practices.',
            },
          ],
        },
      },
      airQualityContext: {
        usAqi: airQuality.aqi.usAqi,
        europeanAqi: airQuality.aqi.europeanAqi,
        dominantPollutant: airQuality.aqi.dominantPollutant,
        pollutants: airQuality.pollutants,
        transparency: airQuality.transparency,
      },
      scenarioContext,
      ventilationGuidance,
      purifierGuidance,
      actionPlan,
      pollutionSources,
      provenanceAndSafety: {
        dataSources: [
          'Saved VAYORA Household Lifestyle Profile (ventilation context, purifier presence, heating type, non-medical household composition)',
          airQuality.transparency.attribution,
          'General indoor air quality principles consistent with US EPA Indoor Air Quality & WHO household energy educational resources (no official endorsement claimed)',
        ],
        nonMedicalNotice: INDOOR_NON_MEDICAL_NOTICE,
        limitationsSummary:
          'Recommendations do not measure actual indoor pollutant concentrations, cannot replace physical carbon monoxide (CO) or smoke alarms, and do not prescribe universal ventilation durations or guaranteed percentage reductions.',
      },
    };

    this.cacheRepository.set(cacheKey, response);
    return response;
  }

  public async refreshIndoorAirGuidance(
    ownerUid: string,
    body: IndoorGuidanceRefreshInput = {},
  ): Promise<IndoorAirGuidanceResponse> {
    if (body.forceRefresh) {
      this.cacheRepository.invalidateOwner(ownerUid);
    }

    const query: IndoorGuidanceQueryInput = {
      ...(body.scenario !== undefined ? { scenario: body.scenario } : {}),
    };

    return this.getIndoorAirGuidance(ownerUid, query, {
      forceRefresh: body.forceRefresh ?? true,
    });
  }
}
