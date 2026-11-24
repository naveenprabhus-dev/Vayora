import crypto from 'node:crypto';
import type {
  AdvisoryEvidenceSource,
  AdvisoryImpactCategory,
  AdvisoryRecommendationCatalogEntry,
  DailyRoutineResponse,
  HouseholdLifestyleRecord,
  IndoorAirGuidanceResponse,
  MinimizedAdvisoryContext,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import { ADVISORY_IMPACT_LABELS } from '../advisory.constants.ts';

function sanitizePromptText(value: string, maxLength = 220): string {
  const withoutControls = Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (
        code < 32 ||
        (code >= 0x7f && code <= 0x9f) ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069)
      ) {
        return ' ';
      }
      return char;
    })
    .join('');

  return withoutControls
    .replaceAll('<', '(')
    .replaceAll('>', ')')
    .replaceAll('```', ' ')
    .replace(/\[\/?\s*inst\s*\]/gi, '[filtered]')
    .replace(
      /\b(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|earlier|system|safety)\b(?:\s+instructions?)?/gi,
      '[filtered]',
    )
    .replace(/\b(?:you\s+are\s+now|system\s*:|assistant\s*:|developer\s*:)\b/gi, '[filtered]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function mapRoutineImpactCategory(
  impactType: DailyRoutineResponse['periods'][number]['items'][number]['impactType'],
): AdvisoryImpactCategory {
  switch (impactType) {
    case 'exposure_reduction':
      return 'personal_exposure';
    case 'emission_reduction':
      return 'local_emissions';
    case 'both':
      return 'both';
  }
}

function mapIndoorImpactCategory(
  item: IndoorAirGuidanceResponse['actionPlan'][number],
): AdvisoryImpactCategory {
  if (
    item.informationCategory === 'estimated_inferred_indoor' &&
    /purifier|hepa|filter|ventilation|window/i.test(`${item.title} ${item.whatToDo}`)
  ) {
    return 'indoor_filtration';
  }
  return 'personal_exposure';
}

function mapAlternativeImpactCategory(
  classification: SustainableAlternativesResponse['alternatives'][number]['impactClassification'],
): AdvisoryImpactCategory {
  switch (classification) {
    case 'personal_exposure':
      return 'personal_exposure';
    case 'local_emissions':
      return 'local_emissions';
    case 'both_exposure_and_emissions':
      return 'both';
    case 'broader_sustainability':
      return 'broader_sustainability';
  }
}

export function buildMinimizedAdvisoryContext(input: {
  readonly profile: HouseholdLifestyleRecord;
  readonly routines: DailyRoutineResponse;
  readonly indoor: IndoorAirGuidanceResponse;
  readonly alternatives: SustainableAlternativesResponse;
}): MinimizedAdvisoryContext {
  const { profile, routines, indoor, alternatives } = input;

  const evidenceMap = new Map<string, AdvisoryEvidenceSource>();

  const coreEvidence: AdvisoryEvidenceSource[] = [
    {
      id: 'EV-OPEN-METEO',
      sourceName: sanitizePromptText(routines.airQualityContext.transparency.providerName, 100),
      sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
      scope: 'Outdoor atmospheric model telemetry & hourly forecast',
      relevantFinding: `Outdoor freshness: ${routines.airQualityContext.transparency.freshnessStatus}. ${sanitizePromptText(routines.airQualityContext.transparency.dataNatureDisclosure, 200)}`,
      limitations:
        'Atmospheric forecast model output rather than street-level wearable or indoor sensors.',
    },
    {
      id: 'EV-EPA-AQI',
      sourceName: 'U.S. EPA — Air Quality Index (AQI) & Particle Exposure Guidance',
      sourceUrl: 'https://www.airnow.gov/aqi/aqi-basics/',
      scope: 'Personal exposure & outdoor exertion categorization',
      relevantFinding: `US AQI scale status: ${routines.airQualityContext.usAqi.category} (${routines.airQualityContext.usAqi.precautionSummary})`,
      limitations: 'Does not replace local municipal emergency advisories or medical advice.',
    },
    {
      id: 'EV-EEA-AQI',
      sourceName: 'European Environment Agency (EEA) — European Air Quality Index',
      sourceUrl: 'https://airindex.eea.europa.eu/',
      scope: 'European air quality band & urban pollutant context',
      relevantFinding: `European AQI scale status: ${routines.airQualityContext.europeanAqi.category} (${routines.airQualityContext.europeanAqi.precautionSummary})`,
      limitations: 'Independent from US AQI thresholds; must not be converted directly.',
    },
    {
      id: 'EV-EPA-INDOOR',
      sourceName: 'U.S. EPA — Indoor Air Quality & Portable Air Cleaners Guidance',
      sourceUrl: 'https://www.epa.gov/indoor-air-quality-iaq',
      scope: 'Indoor particle filtration, cooking ventilation, and HEPA limitations',
      relevantFinding: sanitizePromptText(indoor.purifierGuidance.gasAndVocLimitation, 220),
      limitations:
        'VAYORA has no connected indoor sensors; HEPA filters capture particles, not CO or all gases.',
    },
    {
      id: 'EV-WHO-HOUSEHOLD',
      sourceName: 'WHO — Household Air Pollution & Clean Energy Guidance',
      sourceUrl: 'https://www.who.int/health-topics/air-pollution',
      scope: 'Household combustion sources and ventilation precautions',
      relevantFinding:
        'Reducing indoor combustion smoke and improving kitchen ventilation lowers household particle exposure.',
      limitations: 'General environmental health principles; no clinical guarantee implied.',
    },
  ];

  for (const source of coreEvidence) {
    evidenceMap.set(source.id, source);
  }

  const recommendations: AdvisoryRecommendationCatalogEntry[] = [];

  for (const periodGroup of routines.periods) {
    for (const item of periodGroup.items) {
      const impactCategory = mapRoutineImpactCategory(item.impactType);
      recommendations.push({
        recommendationId: item.id,
        sourceModule: 'routines',
        title: sanitizePromptText(item.title, 160),
        status: item.status,
        statusLabel: sanitizePromptText(item.statusReason, 160),
        impactCategory,
        impactCategoryLabel: ADVISORY_IMPACT_LABELS[impactCategory],
        summary: sanitizePromptText(item.explanation.whatToDo, 240),
        whyRecommended: sanitizePromptText(item.explanation.whyRecommended, 260),
        limitations: sanitizePromptText(item.explanation.limitationsAndTradeoffs, 240),
        evidenceIds: ['EV-OPEN-METEO', 'EV-EPA-AQI', 'EV-EEA-AQI'],
      });
    }
  }

  for (const item of indoor.actionPlan) {
    const impactCategory = mapIndoorImpactCategory(item);
    recommendations.push({
      recommendationId: item.id,
      sourceModule: 'indoor',
      title: sanitizePromptText(item.title, 160),
      status: item.status,
      statusLabel: sanitizePromptText(item.statusLabel, 120),
      impactCategory,
      impactCategoryLabel: ADVISORY_IMPACT_LABELS[impactCategory],
      summary: sanitizePromptText(item.whatToDo, 240),
      whyRecommended: sanitizePromptText(item.whyRecommended, 260),
      limitations: sanitizePromptText(item.limitations, 240),
      evidenceIds: ['EV-EPA-INDOOR', 'EV-WHO-HOUSEHOLD', 'EV-OPEN-METEO'],
    });
  }

  for (const alt of alternatives.alternatives) {
    const evidenceId = `EV-ALT-${alt.id.toUpperCase()}`;
    evidenceMap.set(evidenceId, {
      id: evidenceId,
      sourceName: sanitizePromptText(alt.evidenceReference.sourceName, 140),
      sourceUrl: alt.evidenceReference.sourceUrl,
      scope: `${alt.categoryLabel} · ${alt.affordabilityLabel}`,
      relevantFinding: sanitizePromptText(alt.evidenceReference.relevantFinding, 220),
      limitations: sanitizePromptText(alt.evidenceReference.limitations, 220),
    });

    const impactCategory = mapAlternativeImpactCategory(alt.impactClassification);
    const combinedLimitations = alt.infrastructureConditionality
      ? `${alt.tradeoffsAndLimitations} ${alt.infrastructureConditionality}`
      : alt.tradeoffsAndLimitations;
    recommendations.push({
      recommendationId: alt.id,
      sourceModule: 'alternatives',
      title: sanitizePromptText(alt.title, 160),
      status: alt.suitabilityStatus,
      statusLabel: sanitizePromptText(alt.suitabilityLabel, 120),
      impactCategory,
      impactCategoryLabel: ADVISORY_IMPACT_LABELS[impactCategory],
      summary: sanitizePromptText(alt.suggestedAlternative, 240),
      whyRecommended: sanitizePromptText(alt.whyPreferable, 260),
      limitations: sanitizePromptText(combinedLimitations, 320),
      evidenceIds: [evidenceId, 'EV-OPEN-METEO'],
    });
  }

  const usAqiVal = routines.airQualityContext.usAqi.value;
  const euAqiVal = routines.airQualityContext.europeanAqi.value;
  const isUnavailable =
    routines.airQualityContext.transparency.availabilityStatus === 'unavailable';
  const isHighOrWorse = !isUnavailable && usAqiVal !== null && usAqiVal >= 151;
  const isElevatedOrWorse = !isUnavailable && usAqiVal !== null && usAqiVal >= 101;
  const bestWindow = routines.betterTimeWindows.windows[0] ?? null;

  const isCyclingNotAdvised =
    isHighOrWorse ||
    recommendations.some(
      (entry) =>
        (entry.status === 'not_advised_now' || entry.status === 'unavailable') &&
        /cycl|walk|outdoor/i.test(`${entry.recommendationId} ${entry.title}`),
    );

  const suppliedNumericFacts = new Set<string>([String(profile.householdSize)]);
  if (usAqiVal !== null) {
    suppliedNumericFacts.add(String(usAqiVal));
  }
  if (euAqiVal !== null) {
    suppliedNumericFacts.add(String(euAqiVal));
  }
  if (routines.airQualityContext.dominantPollutant.estimatedSubIndex !== null) {
    suppliedNumericFacts.add(
      String(routines.airQualityContext.dominantPollutant.estimatedSubIndex),
    );
  }
  for (const pollutant of routines.airQualityContext.pollutants) {
    if (pollutant.concentration !== null) {
      suppliedNumericFacts.add(String(pollutant.concentration));
    }
  }
  if (bestWindow?.usAqiMin !== null && bestWindow?.usAqiMin !== undefined) {
    suppliedNumericFacts.add(String(bestWindow.usAqiMin));
  }
  if (bestWindow?.usAqiMax !== null && bestWindow?.usAqiMax !== undefined) {
    suppliedNumericFacts.add(String(bestWindow.usAqiMax));
  }

  return {
    household: {
      city: sanitizePromptText(profile.city, 80),
      neighborhood: sanitizePromptText(profile.neighborhood, 80),
      primaryZoneType: profile.locationPreferences.primaryZoneType,
      householdSize: profile.householdSize,
      householdComposition: [...profile.householdComposition],
      primaryCommuteMode: profile.primaryCommuteMode,
      outdoorActivityPattern: profile.outdoorActivityPattern,
      ventilationContext: profile.ventilationContext,
      hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
      heatingType: profile.heatingType,
      preferredGuidanceFocus: profile.lifestylePreferences.preferredGuidanceFocus,
    },
    airQuality: {
      freshnessStatus: routines.airQualityContext.transparency.freshnessStatus,
      availabilityStatus: routines.airQualityContext.transparency.availabilityStatus,
      observationTimestamp: routines.airQualityContext.transparency.observationTimestamp,
      usAqiValue: usAqiVal,
      usAqiCategory: routines.airQualityContext.usAqi.category,
      europeanAqiValue: euAqiVal,
      europeanAqiCategory: routines.airQualityContext.europeanAqi.category,
      dominantPollutantCode: routines.airQualityContext.dominantPollutant.code,
      dominantPollutantLabel: routines.airQualityContext.dominantPollutant.abbreviation,
      isHighOrWorse,
      isElevatedOrWorse,
      isCyclingNotAdvised,
      bestForecastWindowLabel: bestWindow ? sanitizePromptText(bestWindow.label, 80) : null,
      aqSummary: sanitizePromptText(indoor.overview.outdoorConditionSummary, 240),
      activeScaleNote: 'dual_epa_eea',
    },
    indoorSensorConnected: false,
    ventilationStateLabel: sanitizePromptText(indoor.ventilationGuidance.stateLabel, 100),
    recommendations,
    evidenceSources: [...evidenceMap.values()],
    suppliedNumericFacts: [...suppliedNumericFacts],
  };
}

export function buildAdvisoryFingerprint(params: {
  readonly ownerUid: string;
  readonly operation: string;
  readonly minimizedContext: MinimizedAdvisoryContext;
  readonly targetId?: string;
  readonly extra?: string;
}): string {
  const payload = JSON.stringify({
    operation: params.operation,
    targetId: params.targetId ?? null,
    extra: params.extra ?? null,
    household: params.minimizedContext.household,
    airQuality: params.minimizedContext.airQuality,
    ventilationStateLabel: params.minimizedContext.ventilationStateLabel,
    recommendationStatuses: params.minimizedContext.recommendations.map((item) => ({
      id: item.recommendationId,
      status: item.status,
    })),
  });

  const digest = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  return `${params.ownerUid}::${params.operation}::${digest}`;
}
