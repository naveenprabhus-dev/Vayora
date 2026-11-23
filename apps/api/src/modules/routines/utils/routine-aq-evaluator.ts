import type {
  AirQualityCurrentResponse,
  PollutantCode,
  PollutantDetail,
  PollutionLevelBand,
} from '@uaqa/contracts';
import type { EvaluatedAirQualityState } from '../routines.types.ts';

const LEVEL_RANK: Readonly<Record<PollutionLevelBand, number>> = {
  unavailable: -1,
  low: 0,
  moderate: 1,
  high: 2,
  very_high: 3,
};

function findPollutant(
  pollutants: readonly PollutantDetail[],
  code: PollutantCode,
): PollutantDetail | undefined {
  return pollutants.find((item) => item.code === code);
}

function isBandElevated(detail: PollutantDetail | undefined): boolean {
  return detail?.concentrationBand === 'elevated' || detail?.concentrationBand === 'high';
}

export function evaluateAirQualityForRoutines(
  airQuality: AirQualityCurrentResponse,
): EvaluatedAirQualityState {
  const { usAqi, europeanAqi, dominantPollutant } = airQuality.aqi;
  const { transparency, pollutants } = airQuality;

  const usRank = LEVEL_RANK[usAqi.pollutionLevel];
  const euRank = LEVEL_RANK[europeanAqi.pollutionLevel];

  let effectiveLevel: PollutionLevelBand = 'unavailable';
  if (usRank >= 0 || euRank >= 0) {
    effectiveLevel = usRank >= euRank ? usAqi.pollutionLevel : europeanAqi.pollutionLevel;
  }

  const pm25 = findPollutant(pollutants, 'pm2_5');
  const pm10 = findPollutant(pollutants, 'pm10');
  const no2 = findPollutant(pollutants, 'no2');
  const so2 = findPollutant(pollutants, 'so2');
  const co = findPollutant(pollutants, 'co');
  const o3 = findPollutant(pollutants, 'o3');

  const isPmElevated = isBandElevated(pm25) || isBandElevated(pm10);
  const isNo2Elevated = isBandElevated(no2);
  const isOzoneElevated = isBandElevated(o3);
  const isSo2Elevated = isBandElevated(so2);
  const isCoElevated = isBandElevated(co);

  // If overall AQI is unavailable, stay strictly honest as unavailable,
  // while still honoring individual pollutant elevation flags if partially present.
  const isUnavailable =
    transparency.freshnessStatus === 'unavailable' ||
    (usAqi.status === 'unavailable' && europeanAqi.status === 'unavailable');

  const isStale = transparency.freshnessStatus === 'stale';
  const isHighOrWorse = effectiveLevel === 'high' || effectiveLevel === 'very_high';
  const isElevatedOrWorse =
    effectiveLevel === 'moderate' || isHighOrWorse || isPmElevated || isNo2Elevated;

  const usAqiSnippet =
    usAqi.value !== null ? `US AQI ${usAqi.value} (${usAqi.category})` : 'US AQI Unavailable';
  const europeanAqiSnippet =
    europeanAqi.value !== null
      ? `European AQI ${europeanAqi.value} (${europeanAqi.category})`
      : 'European AQI Unavailable';

  const dominantLabel = dominantPollutant.abbreviation ?? 'mixed urban pollutants';

  const aqContextSummary = isUnavailable
    ? 'Live AQI and pollutant readings are currently unavailable; recommendations rely on saved household context and general clean-air precautions.'
    : `${usAqiSnippet} · ${europeanAqiSnippet}${
        dominantPollutant.status === 'available' && dominantPollutant.abbreviation
          ? ` · Primary driver: ${dominantPollutant.abbreviation}`
          : ''
      }${isStale ? ' (stale cached model data)' : ' (model-derived estimate)'}.`;

  const freshnessNote = isUnavailable
    ? (transparency.fallbackReason ??
      'Upstream air-quality telemetry is unavailable; no AQI numbers or clean-air windows were fabricated.')
    : isStale
      ? `Based on stale cached model telemetry (${transparency.cacheAgeSeconds ?? 0}s old). Live verification is recommended when conditions shift rapidly.`
      : `${transparency.dataNatureDisclosure}`;

  return {
    effectiveLevel,
    isUnavailable,
    isStale,
    isElevatedOrWorse,
    isHighOrWorse,
    isPmElevated,
    isNo2Elevated,
    isOzoneElevated,
    isSo2Elevated,
    isCoElevated,
    dominantCode: dominantPollutant.code,
    dominantLabel,
    usAqiSnippet,
    europeanAqiSnippet,
    aqContextSummary,
    freshnessNote,
  };
}
