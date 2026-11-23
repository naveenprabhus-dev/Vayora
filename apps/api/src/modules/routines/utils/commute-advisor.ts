import type {
  BetterTimeWindowsSummary,
  CommuteRecommendationOption,
  CommuteStrategySummary,
  HouseholdLifestyleRecord,
} from '@uaqa/contracts';
import { COMMUTE_MODE_LABELS, IMPACT_LABELS } from '../routines.constants.ts';
import type { EvaluatedAirQualityState } from '../routines.types.ts';

export function buildCommuteStrategy(options: {
  readonly profile: HouseholdLifestyleRecord;
  readonly effectiveCommuteMode: HouseholdLifestyleRecord['primaryCommuteMode'];
  readonly aqState: EvaluatedAirQualityState;
  readonly betterTimeWindows: BetterTimeWindowsSummary;
}): CommuteStrategySummary {
  const { profile, effectiveCommuteMode, aqState, betterTimeWindows } = options;
  const savedLabel = COMMUTE_MODE_LABELS[profile.primaryCommuteMode] ?? profile.primaryCommuteMode;
  const effectiveLabel = COMMUTE_MODE_LABELS[effectiveCommuteMode] ?? effectiveCommuteMode;
  const isVehicle =
    effectiveCommuteMode === 'gas_vehicle' ||
    effectiveCommuteMode === 'ev' ||
    effectiveCommuteMode === 'carpool';
  const isActive = effectiveCommuteMode === 'walking' || effectiveCommuteMode === 'cycling';
  const isDenseOrValley =
    profile.locationPreferences.primaryZoneType === 'urban_core' ||
    profile.locationPreferences.primaryZoneType === 'valley_basin';

  const bestWindowLabel = betterTimeWindows.windows[0]?.label ?? null;

  const exposureVsEmissionsNote =
    'Lower-emission travel (such as walking, cycling, or transit) cuts tailpipe pollution for your neighborhood, but does not automatically lower personal inhalation exposure during smog peaks or along busy roads where exhaust concentrates.';

  let headline = `Commute plan tailored to ${effectiveLabel}`;
  if (aqState.isUnavailable) {
    headline = `Baseline low-emission commute guidance (${effectiveLabel} — live telemetry unavailable)`;
  } else if (aqState.isHighOrWorse) {
    headline = `Elevated smog commute adjustments for ${effectiveLabel}`;
  } else if (aqState.isElevatedOrWorse) {
    headline = `Targeted route and timing adjustments for ${effectiveLabel}`;
  }

  const recommendations: CommuteRecommendationOption[] = [];

  if (effectiveCommuteMode === 'gas_vehicle') {
    recommendations.push({
      id: 'commute-consolidate-cold-starts',
      modeLabel: 'Consolidated vehicle trips & zero idling',
      status: 'recommended',
      statusReason: 'Reduces cold-start tailpipe exhaust and neighborhood idling spikes.',
      impactType: 'both',
      impactLabel: IMPACT_LABELS.both,
      summary:
        'Group errands into a single warm-engine loop and switch off the engine while waiting at schools or curbs.',
      reason: `Saved mode is ${savedLabel}${aqState.isNo2Elevated ? ' and roadway NO2 is currently elevated' : ''}.`,
      infrastructureNote:
        'Applies directly to existing household driving without external transit access.',
    });

    recommendations.push({
      id: 'commute-shift-transit-or-carpool',
      modeLabel: 'Shared carpool or local public transit',
      status: aqState.isHighOrWorse ? 'recommended' : 'optional',
      statusReason: aqState.isHighOrWorse
        ? 'Reduces per-person tailpipe emissions on high-smog days when shared options exist.'
        : 'Optional lower-emission alternative where reliable local routes fit your trip.',
      impactType: 'emission_reduction',
      impactLabel: IMPACT_LABELS.emission_reduction,
      summary:
        'Share rides with neighbors or use bus/tram/rail connections for routine corridors when available.',
      reason:
        'Removing solo fuel-burning trips lowers local NO2 and PM2.5 buildup across winter inversion zones.',
      infrastructureNote:
        'Only practical where public transit stops, schedules, or carpool partners exist in your neighborhood.',
    });
  } else if (effectiveCommuteMode === 'ev' || effectiveCommuteMode === 'carpool') {
    recommendations.push({
      id: 'commute-ev-carpool-recirculate',
      modeLabel: `${effectiveLabel} with trip bundling`,
      status: 'recommended',
      statusReason: 'Lowers congestion, non-exhaust brake/tire dust, and cabin infiltration.',
      impactType: 'both',
      impactLabel: IMPACT_LABELS.both,
      summary: aqState.isElevatedOrWorse
        ? 'Combine errands into fewer trips, use smooth braking, and switch cabin HVAC to recirculate in heavy traffic.'
        : 'Continue combining routine errands into shared or single trips to minimize roadway congestion.',
      reason: `Saved mode is ${effectiveLabel}${bestWindowLabel ? `; cleaner travel window: ${bestWindowLabel}` : ''}.`,
      infrastructureNote:
        'Uses your existing vehicle cabin ventilation controls and trip planning.',
    });
  } else if (effectiveCommuteMode === 'public_transit') {
    recommendations.push({
      id: 'commute-transit-wait-sheltered',
      modeLabel: 'Public transit with low-exposure boarding',
      status: 'recommended',
      statusReason:
        'Preserves low per-person emissions while limiting curbside exhaust inhalation.',
      impactType: 'both',
      impactLabel: IMPACT_LABELS.both,
      summary: aqState.isElevatedOrWorse
        ? 'Keep using public transit where available, wait slightly back from idling bus lanes, and travel outside rush hour if flexible.'
        : 'Continue using public transit to keep neighborhood combustion emissions low.',
      reason: `Current conditions: ${aqState.usAqiSnippet}; ${aqState.europeanAqiSnippet}.`,
      infrastructureNote:
        'Depends on existing transit stop frequency and sheltered waiting areas along your route.',
    });
  }

  // Walking / cycling evaluation — NEVER recommend vigorous cycling or prolonged walking during high/very_high pollution
  if (aqState.isHighOrWorse) {
    recommendations.push({
      id: 'commute-active-travel-unavailable',
      modeLabel: 'Cycling or prolonged roadside walking',
      status: 'unavailable',
      statusReason:
        'Not recommended during high/very high air pollution due to increased breathing rate and higher particulate inhalation.',
      impactType: 'exposure_reduction',
      impactLabel: IMPACT_LABELS.exposure_reduction,
      summary:
        'Temporarily pause vigorous cycling or long outdoor walking commutes until AQI drops out of the high band.',
      reason: `High pollution conditions (${aqState.dominantLabel}) raise inhaled dose during physical exertion outdoors.`,
      infrastructureNote:
        'Use sheltered public transit (where available), remote flexibility if offered, or brief masked trips only when essential.',
    });
  } else if (aqState.isElevatedOrWorse || aqState.isNo2Elevated) {
    recommendations.push({
      id: 'commute-side-street-active',
      modeLabel: 'Walking or gentle cycling on side-street routes',
      status: isActive ? 'recommended' : 'optional',
      statusReason: isActive
        ? 'Retains zero-tailpipe travel while cutting direct curbside NO2 and PM exposure.'
        : 'Optional low-emission swap for short trips if safe side streets or paths exist.',
      impactType: 'both',
      impactLabel: IMPACT_LABELS.both,
      summary:
        'Shift at least one block off busy arterial roads, pace exertion gently, and prefer cleaner forecast windows when available.',
      reason: `${aqState.isNo2Elevated ? 'Elevated NO2 concentrates along vehicle lanes; ' : ''}${isDenseOrValley ? 'urban/valley corridors trap roadside exhaust.' : 'side streets dilute tailpipe plumes.'}`,
      infrastructureNote:
        'Assumes safe, well-lit sidewalks or separated bike routes exist; do not take unsafe unlit routes.',
    });
  } else if (aqState.isUnavailable) {
    recommendations.push({
      id: 'commute-active-unavailable-telemetry',
      modeLabel: 'Forecast-timed active commute shifts',
      status: 'unavailable',
      statusReason:
        'Live AQI telemetry is unavailable, so exact high-risk vs low-risk active travel windows cannot be verified.',
      impactType: 'exposure_reduction',
      impactLabel: IMPACT_LABELS.exposure_reduction,
      summary: isActive
        ? 'Check visible road haze and avoid heavy rush-hour arterials when walking or cycling.'
        : 'Combine trips where possible and verify local conditions before shifting to prolonged outdoor cycling.',
      reason: 'Telemetry feed is currently unreachable; safety thresholds cannot be confirmed.',
      infrastructureNote:
        'Side-street routing depends on safe local pedestrian and cycling infrastructure.',
    });
  } else {
    recommendations.push({
      id: 'commute-active-favorable',
      modeLabel: 'Walking or cycling on neighborhood corridors',
      status: isActive ? 'recommended' : 'optional',
      statusReason:
        'Low current pollution supports zero-emission walking or cycling where safe paths exist.',
      impactType: 'both',
      impactLabel: IMPACT_LABELS.both,
      summary: isVehicle
        ? 'Consider walking or cycling for short local trips (< 2 km) instead of cold-starting a car.'
        : 'Continue zero-emission walking or cycling along parkways or calmer neighborhood streets.',
      reason: `Current air quality sits in the low band (${aqState.usAqiSnippet}; ${aqState.europeanAqiSnippet}).`,
      infrastructureNote:
        'Only undertake where safe sidewalks, crosswalks, or dedicated cycling paths exist locally.',
    });
  }

  return {
    savedMode: profile.primaryCommuteMode,
    effectiveMode: effectiveCommuteMode,
    headline,
    exposureVsEmissionsNote,
    options: recommendations,
  };
}
