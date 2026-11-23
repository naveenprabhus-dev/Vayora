import type {
  BetterTimeWindowsSummary,
  DailyRoutineOverview,
  HouseholdLifestyleRecord,
  InformationBasis,
  RoutineActionStatus,
  RoutineCategory,
  RoutineImpactType,
  RoutinePeriodGroup,
  RoutineRecommendationItem,
  RoutineTimePeriod,
} from '@uaqa/contracts';
import {
  COMMUTE_MODE_LABELS,
  IMPACT_LABELS,
  ROUTINE_PERIOD_METADATA,
} from '../routines.constants.ts';
import type { EvaluatedAirQualityState } from '../routines.types.ts';

interface RuleDraft {
  readonly id: string;
  readonly period: RoutineTimePeriod;
  readonly category: RoutineCategory;
  readonly title: string;
  readonly status: RoutineActionStatus;
  readonly statusReason: string;
  readonly basePriority: number;
  readonly suggestedWindow: string;
  readonly impactType: RoutineImpactType;
  readonly whatToDo: string;
  readonly whyRecommended: string;
  readonly influencingData: readonly string[];
  readonly expectedBenefit: string;
  readonly limitationsAndTradeoffs: string;
  readonly practicalAlternative: string | null;
  readonly informationBasis: InformationBasis;
}

const STATUS_SORT_ORDER: Readonly<Record<RoutineActionStatus, number>> = {
  recommended: 0,
  optional: 1,
  unavailable: 2,
};

function computeFocusedPriority(
  draft: RuleDraft,
  focus: HouseholdLifestyleRecord['lifestylePreferences']['preferredGuidanceFocus'],
): number {
  let score = draft.basePriority;
  if (
    focus === 'commute_exposure' &&
    (draft.category === 'commute' || draft.category === 'errands')
  ) {
    score += 12;
  } else if (
    focus === 'low_emission_habits' &&
    (draft.impactType === 'emission_reduction' || draft.impactType === 'both')
  ) {
    score += 12;
  } else if (
    focus === 'indoor_air' &&
    (draft.category === 'household_energy' || draft.impactType === 'exposure_reduction')
  ) {
    score += 10;
  }
  return Math.min(100, Math.max(1, score));
}

function finalizeItem(
  draft: RuleDraft,
  aqState: EvaluatedAirQualityState,
  focus: HouseholdLifestyleRecord['lifestylePreferences']['preferredGuidanceFocus'],
): RoutineRecommendationItem {
  return {
    id: draft.id,
    period: draft.period,
    category: draft.category,
    title: draft.title,
    status: draft.status,
    statusReason: draft.statusReason,
    priorityScore: computeFocusedPriority(draft, focus),
    suggestedWindow: draft.suggestedWindow,
    impactType: draft.impactType,
    impactLabel: IMPACT_LABELS[draft.impactType],
    explanation: {
      whatToDo: draft.whatToDo,
      whyRecommended: draft.whyRecommended,
      influencingData: draft.influencingData,
      expectedBenefit: draft.expectedBenefit,
      limitationsAndTradeoffs: draft.limitationsAndTradeoffs,
    },
    airQualityContext: aqState.aqContextSummary,
    practicalAlternative: draft.practicalAlternative,
    freshnessAndUncertainty: aqState.freshnessNote,
    informationBasis: draft.informationBasis,
  };
}

export function buildPersonalizedRoutinePeriods(options: {
  readonly profile: HouseholdLifestyleRecord;
  readonly effectiveCommuteMode: HouseholdLifestyleRecord['primaryCommuteMode'];
  readonly effectiveOutdoorPattern: HouseholdLifestyleRecord['outdoorActivityPattern'];
  readonly aqState: EvaluatedAirQualityState;
  readonly betterTimeWindows: BetterTimeWindowsSummary;
}): {
  readonly periods: readonly RoutinePeriodGroup[];
  readonly overview: DailyRoutineOverview;
} {
  const { profile, effectiveCommuteMode, effectiveOutdoorPattern, aqState, betterTimeWindows } =
    options;

  const hasYoungChildren = profile.householdComposition.includes('young_children');
  const hasSchoolChildren = profile.householdComposition.includes('school_age_children');
  const hasOlderAdults = profile.householdComposition.includes('older_adults');
  const hasPets = profile.householdComposition.includes('pets');
  const usesSolidFuel = profile.heatingType === 'solid_fuel';
  const usesNaturalGas = profile.heatingType === 'natural_gas';
  const isVehicleCommuter =
    effectiveCommuteMode === 'gas_vehicle' ||
    effectiveCommuteMode === 'ev' ||
    effectiveCommuteMode === 'carpool';
  const isActiveCommuter = effectiveCommuteMode === 'walking' || effectiveCommuteMode === 'cycling';

  const commuteLabel = COMMUTE_MODE_LABELS[effectiveCommuteMode] ?? effectiveCommuteMode;
  const aqBasis: InformationBasis = aqState.isUnavailable ? 'unavailable' : 'model_derived';
  const firstWindow = betterTimeWindows.windows[0];
  const middayWindow = betterTimeWindows.windows.find((w) => w.period === 'midday') ?? firstWindow;

  const drafts: RuleDraft[] = [];

  // ---------------------------------------------------------------------------
  // 1. MORNING (06:00 – 11:00)
  // ---------------------------------------------------------------------------
  if (hasYoungChildren || hasSchoolChildren || effectiveOutdoorPattern === 'school_run_family') {
    drafts.push({
      id: 'morning-school-family-routine',
      period: 'morning',
      category: 'commute',
      title: aqState.isHighOrWorse
        ? 'Minimize roadside wait time during morning school drop-off'
        : 'Coordinate low-emission morning school or childcare drop-off',
      status: 'recommended',
      statusReason: 'Tailored to saved family household composition and morning travel timing.',
      basePriority: 92,
      suggestedWindow: '07:30 – 09:00 local time',
      impactType: 'both',
      whatToDo: aqState.isHighOrWorse
        ? 'Wait indoors until just before arrival, switch vehicle engines off immediately at drop-off, and keep morning stroller or playground time brief.'
        : isVehicleCommuter
          ? 'Avoid engine idling near school gates, or share a carpool/walking bus along quieter side streets where safe paths exist.'
          : 'Walk or use transit along side streets one block away from main commuter arteries where safe sidewalks exist.',
      whyRecommended:
        'Morning winter boundary layers frequently hold vehicle exhaust near street level around school drop-off corridors.',
      influencingData: [
        `Household composition: ${profile.householdComposition.join(', ')}`,
        `Effective commute mode: ${commuteLabel}`,
        `Location zone: ${profile.locationPreferences.primaryZoneType}`,
        aqState.isUnavailable
          ? 'Live AQI: Unavailable (baseline precaution)'
          : aqState.usAqiSnippet,
      ],
      expectedBenefit:
        'Lowers concentrated curb exhaust around children and reduces unnecessary morning fuel idling.',
      limitationsAndTradeoffs:
        'Side-street walking or carpooling requires safe pedestrian crossings and coordinated neighbor schedules; this does not replace caregiver judgment.',
      practicalAlternative: aqState.isHighOrWorse
        ? 'Move morning outdoor recess or playtime to indoor spaces until hourly readings improve.'
        : 'If driving is unavoidable, pre-plan a single shared trip with nearby families.',
      informationBasis: aqState.isUnavailable ? 'rule_derived' : 'model_derived',
    });
  } else if (
    effectiveOutdoorPattern === 'morning_commute' ||
    isVehicleCommuter ||
    isActiveCommuter ||
    effectiveCommuteMode === 'public_transit'
  ) {
    const activeBlocked = isActiveCommuter && aqState.isHighOrWorse;
    drafts.push({
      id: 'morning-commute-shift',
      period: 'morning',
      category: 'commute',
      title: activeBlocked
        ? 'Pause vigorous morning cycling or long walking commute'
        : isVehicleCommuter
          ? 'Bundle morning commute stops and avoid cold-start detours'
          : 'Select sheltered or low-traffic morning commute corridors',
      status: activeBlocked ? 'unavailable' : 'recommended',
      statusReason: activeBlocked
        ? 'High pollution increases inhalation risk during vigorous outdoor cycling or long brisk walks.'
        : 'Matches your primary morning commute mode and current dispersion state.',
      basePriority: 88,
      suggestedWindow: '07:00 – 09:30 local time',
      impactType: isVehicleCommuter ? 'both' : activeBlocked ? 'exposure_reduction' : 'both',
      whatToDo: activeBlocked
        ? 'Defer strenuous cycling or long outdoor walks today; use sheltered public transit where available, remote work flexibility if possible, or brief essential trips only.'
        : isVehicleCommuter
          ? 'Combine morning drop-offs or coffee stops into a single continuous drive, avoid warming up the engine while parked, and use cabin air recirculation in slow traffic.'
          : 'Walk or ride on residential streets parallel to main roads and stand upwind of idling bus or car queues.',
      whyRecommended: aqState.isNo2Elevated
        ? 'Morning traffic congestion elevates nitrogen dioxide (NO2) directly alongside arterial roadways.'
        : 'Morning commutes combine peak traffic density with cooler, slower atmospheric mixing.',
      influencingData: [
        `Commute mode: ${commuteLabel}`,
        `Outdoor pattern: ${effectiveOutdoorPattern}`,
        aqState.isUnavailable
          ? 'Air quality status: Unavailable'
          : `${aqState.usAqiSnippet}; ${aqState.europeanAqiSnippet}`,
      ],
      expectedBenefit: activeBlocked
        ? 'Prevents elevated respiratory particle uptake while keeping zero-emission intent intact.'
        : isVehicleCommuter
          ? 'Cuts repeated cold-start fuel enrichment emissions and reduces cabin exhaust entry.'
          : 'Maintains low neighborhood tailpipe emissions while trimming curbside exhaust exposure.',
      limitationsAndTradeoffs:
        'Public transit availability, remote work flexibility, and quiet side-street sidewalks vary by neighborhood and require local verification.',
      practicalAlternative: activeBlocked
        ? 'If brief outdoor walking is unavoidable along congested roads, use a well-fitting N95/FFP2 respirator.'
        : 'Leave 15 minutes earlier or later than peak school/office traffic when schedules allow.',
      informationBasis: aqBasis,
    });
  }

  if (hasPets) {
    drafts.push({
      id: 'morning-pet-walk-routine',
      period: 'morning',
      category: 'outdoor_activity',
      title: aqState.isHighOrWorse
        ? 'Keep morning pet walks brief along quiet side streets'
        : 'Schedule morning pet walk away from idling traffic',
      status: 'recommended',
      statusReason: 'Household profile includes pets requiring regular morning outdoor breaks.',
      basePriority: 74,
      suggestedWindow: '07:00 – 10:00 local time',
      impactType: 'exposure_reduction',
      whatToDo: aqState.isHighOrWorse
        ? 'Limit the morning walk to a short, low-exertion relief loop away from main roads, and wait for midday if longer exercise is needed.'
        : 'Follow shaded parks or side streets off main commuter roads rather than walking beside rush-hour traffic.',
      whyRecommended:
        'Pets and handlers inhale concentrated ground-level particulate and exhaust plumes near curb lanes.',
      influencingData: [
        'Household composition includes pets',
        aqState.isUnavailable ? 'Air quality telemetry: Unavailable' : aqState.dominantLabel,
      ],
      expectedBenefit:
        'Reduces direct morning inhalation of street-level particulates for both walker and pet.',
      limitationsAndTradeoffs:
        'Shortening morning walks may require extra indoor enrichment when smog stays high.',
      practicalAlternative:
        'Shift longer daily pet play into indoor corridors when particulate levels stay high.',
      informationBasis: aqState.isUnavailable ? 'qualitative_estimate' : 'model_derived',
    });
  }

  if (usesSolidFuel || usesNaturalGas || profile.householdSize >= 3) {
    drafts.push({
      id: 'morning-heating-kitchen-habits',
      period: 'morning',
      category: 'household_energy',
      title: usesSolidFuel
        ? 'Use clean-burn startup and dry seasoned fuel for morning heating'
        : 'Run kitchen ventilation and avoid excess morning heat loss',
      status: 'recommended',
      statusReason: `Customized for ${profile.heatingType.replace('_', ' ')} home heating and household size (${profile.householdSize}).`,
      basePriority: 70,
      suggestedWindow: '06:30 – 09:00 local time',
      impactType: usesSolidFuel ? 'both' : 'emission_reduction',
      whatToDo: usesSolidFuel
        ? 'If lighting a stove, use dry seasoned fuel with top-down ignition and full air draft; prefer electric backup heating during inversion advisories if installed.'
        : 'Turn on the kitchen range hood while cooking breakfast and keep thermostats steady rather than overheating rooms before opening windows.',
      whyRecommended:
        'Morning heating demand and indoor cooking spikes contribute to fine particulate buildup indoors and in winter neighborhoods.',
      influencingData: [
        `Heating type: ${profile.heatingType}`,
        `Household size: ${profile.householdSize}`,
        `Zone type: ${profile.locationPreferences.primaryZoneType}`,
      ],
      expectedBenefit: usesSolidFuel
        ? 'Reduces dense smoldering smoke emissions into both your home and surrounding street.'
        : 'Lowers energy waste and captures breakfast cooking aerosols before they linger indoors.',
      limitationsAndTradeoffs:
        'Backup electric heating depends on installed household equipment and utility rates.',
      practicalAlternative: usesSolidFuel
        ? 'Close interior doors to sleeping rooms during stove ignition and run HEPA filtration if available.'
        : 'Use electric kettles or induction/microwave appliances where available to reduce gas combustion byproducts.',
      informationBasis: 'rule_derived',
    });
  }

  // ---------------------------------------------------------------------------
  // 2. MIDDAY (12:00 – 16:00)
  // ---------------------------------------------------------------------------
  if (betterTimeWindows.status === 'unavailable') {
    drafts.push({
      id: 'midday-forecast-window-unavailable',
      period: 'midday',
      category: 'scheduling',
      title: 'Forecast-timed cleaner midday outdoor window',
      status: 'unavailable',
      statusReason:
        'Hourly air-quality forecast data is currently unavailable, so a specific cleaner time window cannot be verified or fabricated.',
      basePriority: 85,
      suggestedWindow: 'Exact forecast window unavailable',
      impactType: 'exposure_reduction',
      whatToDo:
        'Do not rely on an assumed clean midday hour today; keep outdoor errands brief and observe visible street haze before extended exertion.',
      whyRecommended:
        'Fabricating a safer time window without verified hourly model output risks sending households outdoors during an unmeasured spike.',
      influencingData: [
        `Forecast status: ${betterTimeWindows.status}`,
        betterTimeWindows.limitationDisclosure,
      ],
      expectedBenefit:
        'Prevents false confidence from unverified timing estimates while preserving cautious outdoor planning.',
      limitationsAndTradeoffs:
        'Without hourly telemetry, households must check local haze visually and prioritize essential errands only.',
      practicalAlternative:
        'Favor side streets away from midday commercial loading zones and resume indoor movement if air looks hazy.',
      informationBasis: 'unavailable',
    });
  } else {
    const windowTitle = aqState.isOzoneElevated
      ? 'Protect afternoon routines from ozone buildup'
      : 'Use the comparatively cleaner midday forecast window for outdoor tasks';
    const isWindowStillHigh =
      middayWindow?.usAqiMax !== null &&
      middayWindow?.usAqiMax !== undefined &&
      middayWindow.usAqiMax > 150;

    drafts.push({
      id: 'midday-forecast-outdoor-window',
      period: 'midday',
      category: 'scheduling',
      title: isWindowStillHigh
        ? 'Keep midday outdoor errands brief despite relative forecast dip'
        : windowTitle,
      status: isWindowStillHigh ? 'optional' : 'recommended',
      statusReason: isWindowStillHigh
        ? 'Forecast shows a slight dip, yet AQI remains in the unhealthy band.'
        : `Derived from hourly forecast comparison${betterTimeWindows.status === 'stale' ? ' (stale cached forecast)' : ''}.`,
      basePriority: 90,
      suggestedWindow: middayWindow ? middayWindow.label : '12:00 – 15:30 local time',
      impactType: 'exposure_reduction',
      whatToDo: aqState.isOzoneElevated
        ? 'Since surface ozone peaks with midday sunlight, avoid strenuous afternoon exercise and shift light errands to late morning instead.'
        : isWindowStillHigh
          ? 'Use this relatively lower window only for essential errands or brief fresh air breaks rather than prolonged exercise.'
          : 'Schedule outdoor walking, light exercise, or short fresh-air airing inside this forecast window rather than during evening cooling.',
      whyRecommended: middayWindow
        ? middayWindow.rationale
        : 'Daytime thermal mixing often improves pollutant dispersion compared to calm winter mornings and evenings.',
      influencingData: [
        middayWindow
          ? `Forecast window: ${middayWindow.label} (US AQI ${middayWindow.usAqiMin ?? 'N/A'}–${middayWindow.usAqiMax ?? 'N/A'}; EU AQI ${middayWindow.europeanAqiMin ?? 'N/A'}–${middayWindow.europeanAqiMax ?? 'N/A'})`
          : 'Hourly forecast comparison',
        `Outdoor pattern: ${effectiveOutdoorPattern}`,
        aqState.isOzoneElevated
          ? 'Individual pollutant flag: Ground-level O3 elevated'
          : `Dominant pollutant: ${aqState.dominantLabel}`,
      ],
      expectedBenefit:
        'Aligns unavoidable outdoor errands with comparatively better atmospheric dispersion rather than peak accumulation hours.',
      limitationsAndTradeoffs: `${betterTimeWindows.limitationDisclosure} Micro-scale street traffic near busy intersections can still exceed regional forecast levels.`,
      practicalAlternative:
        'If daytime work or school prevents midday errands, prioritize consolidated indoor or low-exertion trips.',
      informationBasis: 'model_derived',
    });
  }

  drafts.push({
    id: 'midday-errand-consolidation',
    period: 'midday',
    category: 'errands',
    title: isVehicleCommuter
      ? 'Chain midday errands into one trip to eliminate extra cold starts'
      : 'Batch household errands into one walking or transit loop',
    status: 'recommended',
    statusReason: 'Relevant across households to reduce repetitive vehicle or roadside trips.',
    basePriority: 82,
    suggestedWindow: middayWindow ? middayWindow.label : '12:00 – 16:00 local time',
    impactType: isVehicleCommuter ? 'emission_reduction' : 'both',
    whatToDo: isVehicleCommuter
      ? 'Combine grocery, pharmacy, and post-office stops into one planned loop (starting with the farthest stop) instead of multiple short cold-start drives.'
      : 'Group neighborhood errands into one single off-peak loop using quiet streets or transit when local routes fit.',
    whyRecommended:
      'Repeated short solo car trips cause disproportionately high per-kilometer emissions while catalytic converters are cold.',
    influencingData: [`Household size: ${profile.householdSize}`, `Commute mode: ${commuteLabel}`],
    expectedBenefit:
      'Reduces total fuel burned, local tailpipe exhaust, and cumulative time spent waiting near traffic.',
    limitationsAndTradeoffs:
      'Requires planning a shared household shopping list ahead of departure and carrying combined bags.',
    practicalAlternative:
      'Coordinate shared supply pickups with a neighbor or combine errands onto an existing return commute.',
    informationBasis: 'rule_derived',
  });

  if (profile.ventilationContext === 'natural_windows' || profile.hasIndoorAirPurifier) {
    const airingBlocked = aqState.isHighOrWorse;
    drafts.push({
      id: 'midday-airing-vs-filtration',
      period: 'midday',
      category: 'household_energy',
      title: airingBlocked
        ? 'Extended window-open airing suspended during high smog'
        : 'Brief midday cross-ventilation while outdoor dispersion is better',
      status: airingBlocked ? 'unavailable' : 'optional',
      statusReason: airingBlocked
        ? 'High outdoor particulate/gas levels would infiltrate indoor spaces if windows are held open.'
        : 'Optional short indoor air exchange when outdoor conditions are low to moderate.',
      basePriority: 68,
      suggestedWindow: middayWindow ? middayWindow.label : '13:00 – 15:00 local time',
      impactType: 'exposure_reduction',
      whatToDo: airingBlocked
        ? profile.hasIndoorAirPurifier
          ? 'Keep windows closed, pause long natural airing, and run your indoor HEPA purifier on medium-high recirculation.'
          : 'Keep exterior windows sealed during smog peaks and rely on interior circulation without outdoor intake.'
        : 'Open cross-facing windows briefly (10–15 minutes) during the cleanest daytime window and close them before dusk.',
      whyRecommended:
        'Balancing indoor freshness against outdoor particulate entry depends on current ambient PM and NO2 concentrations.',
      influencingData: [
        `Ventilation setup: ${profile.ventilationContext}`,
        `HEPA purifier installed: ${profile.hasIndoorAirPurifier ? 'Yes' : 'No'}`,
        aqState.isUnavailable ? 'Live AQI: Unavailable' : aqState.usAqiSnippet,
      ],
      expectedBenefit: airingBlocked
        ? 'Limits outdoor smog infiltration while managing indoor air quality.'
        : 'Refreshes indoor air without prolonged heat loss or evening smoke entry.',
      limitationsAndTradeoffs:
        'Opening windows briefly loses indoor warmth in winter; closed-window periods require minimizing indoor smoke from cooking or candles.',
      practicalAlternative: airingBlocked
        ? 'Use brief kitchen/bathroom exhaust fans strictly during cooking or showering, then switch off.'
        : 'Keep street-facing windows shut if heavy midday delivery traffic passes outside.',
      informationBasis: aqState.isUnavailable ? 'rule_derived' : 'model_derived',
    });
  }

  // ---------------------------------------------------------------------------
  // 3. EVENING (17:00 – 21:00)
  // ---------------------------------------------------------------------------
  const isEveningExerciser =
    effectiveOutdoorPattern === 'evening_exercise' ||
    effectiveOutdoorPattern === 'extended_outdoor' ||
    hasOlderAdults;
  if (isEveningExerciser || aqState.isElevatedOrWorse) {
    const eveningHigh = aqState.isHighOrWorse;
    drafts.push({
      id: 'evening-exercise-adjustment',
      period: 'evening',
      category: 'outdoor_activity',
      title: eveningHigh
        ? 'High-exertion outdoor evening exercise'
        : aqState.isElevatedOrWorse
          ? 'Shift evening workout indoors or lower intensity'
          : 'Choose quieter evening walking or exercise corridors',
      status: eveningHigh ? 'unavailable' : aqState.isElevatedOrWorse ? 'optional' : 'recommended',
      statusReason: eveningHigh
        ? 'Elevated evening smog and increased breathing volume make outdoor high-exertion workouts unsafe.'
        : aqState.isElevatedOrWorse
          ? 'Optional low-exertion stroll along quiet streets if midday movement was missed.'
          : 'Supports routine evening movement while air quality remains low.',
      basePriority: 91,
      suggestedWindow: '17:00 – 20:30 local time',
      impactType: 'exposure_reduction',
      whatToDo: eveningHigh
        ? 'Move evening workouts indoors (stretching, strength, or indoor cardio) instead of running or intense cycling outdoors.'
        : aqState.isElevatedOrWorse
          ? 'Replace strenuous evening runs with indoor exercise or a gentle walk away from traffic and residential chimneys.'
          : 'Keep evening walks or runs along parks and low-traffic residential paths rather than busy arterial sidewalks.',
      whyRecommended:
        'Evening cooling traps rush-hour tailpipe exhaust and residential heating smoke near ground level, especially in urban cores and valleys.',
      influencingData: [
        `Outdoor activity pattern: ${effectiveOutdoorPattern}`,
        `Location zone: ${profile.locationPreferences.primaryZoneType}`,
        aqState.isUnavailable ? 'Live AQI: Unavailable' : aqState.aqContextSummary,
      ],
      expectedBenefit:
        'Lowers deep lung deposition of fine particles during periods when winter temperature inversions typically tighten.',
      limitationsAndTradeoffs:
        'Shifting workouts indoors changes routine preferences; older adults and families should pace activity comfortably without treating this as medical advice.',
      practicalAlternative:
        middayWindow && !eveningHigh
          ? `Reschedule outdoor exercise to ${middayWindow.label}.`
          : 'Complete mobility or strength sessions indoors with windows closed.',
      informationBasis: aqBasis,
    });
  }

  drafts.push({
    id: 'evening-return-commute-heating',
    period: 'evening',
    category: usesSolidFuel ? 'household_energy' : 'commute',
    title: usesSolidFuel
      ? 'Avoid damp fuel or waste burning during evening inversion hours'
      : 'Prevent evening heat loss and trim return-trip idling',
    status: 'recommended',
    statusReason: usesSolidFuel
      ? 'Evening stove burns strongly affect neighborhood winter PM2.5.'
      : 'Combines lower-emission home energy habits with evening return-trip discipline.',
    basePriority: usesSolidFuel ? 94 : 78,
    suggestedWindow: '17:30 – 21:00 local time',
    impactType: usesSolidFuel ? 'both' : 'emission_reduction',
    whatToDo: usesSolidFuel
      ? 'Never burn wet wood, painted timber, or household waste; keep stove air supply unobstructed and use electric/district heat if available during elevated smog.'
      : 'Close window blinds/curtains at dusk to retain indoor warmth, set evening heating to a moderate temperature, and switch off car engines while unloading groceries or waiting.',
    whyRecommended:
      'Evening temperature drops slow vertical air mixing, causing both chimney smoke and idling exhaust to linger through nightfall.',
    influencingData: [
      `Heating type: ${profile.heatingType}`,
      `Location zone: ${profile.locationPreferences.primaryZoneType}`,
      aqState.isPmElevated
        ? 'Individual pollutant flag: PM2.5/PM10 elevated'
        : `Dominant pollutant: ${aqState.dominantLabel}`,
    ],
    expectedBenefit: usesSolidFuel
      ? 'Reduces thick visible particulate smoke in your home and immediate neighborhood.'
      : 'Lowers overall evening fuel demand and cuts unnecessary curb emissions.',
    limitationsAndTradeoffs:
      'Lowering thermostat setpoints or switching off solid-fuel stoves depends on insulation quality and alternative heat availability.',
    practicalAlternative:
      'Wear layered indoor clothing so heating systems run at steady moderate output rather than peak cycles.',
    informationBasis: aqState.isUnavailable ? 'rule_derived' : 'model_derived',
  });

  // ---------------------------------------------------------------------------
  // 4. NIGHT (22:00 – 05:00)
  // ---------------------------------------------------------------------------
  drafts.push({
    id: 'night-sleeping-room-routine',
    period: 'night',
    category: 'household_energy',
    title: aqState.isElevatedOrWorse
      ? 'Close sleeping-room windows overnight and limit indoor smoke'
      : 'Maintain clean, unpolluted overnight sleeping-room air',
    status: 'recommended',
    statusReason: 'Overnight winter inversions trap accumulated particulates until morning sun.',
    basePriority: hasYoungChildren || hasOlderAdults ? 89 : 76,
    suggestedWindow: '22:00 – 05:30 local time',
    impactType: 'exposure_reduction',
    whatToDo: profile.hasIndoorAirPurifier
      ? 'Keep exterior bedroom windows shut overnight during moderate or worse smog and run your HEPA purifier on quiet sleep setting; avoid overnight incense or candles.'
      : 'Close street-facing bedroom windows overnight when local smog or chill settles, eliminate indoor candles/smoke, and keep bedroom doors balanced for comfortable warmth.',
    whyRecommended:
      profile.locationPreferences.primaryZoneType === 'valley_basin' ||
      profile.locationPreferences.primaryZoneType === 'industrial_adjacent'
        ? 'Valley basins and industrial corridors commonly hold trapped PM2.5 and SO2 overnight.'
        : 'Overnight cooling reduces dispersion, allowing outdoor particulate levels to remain elevated until late morning.',
    influencingData: [
      `Location zone: ${profile.locationPreferences.primaryZoneType}`,
      `Household composition: ${profile.householdComposition.join(', ')}`,
      `HEPA purifier installed: ${profile.hasIndoorAirPurifier ? 'Yes' : 'No'}`,
    ],
    expectedBenefit:
      'Supports cleaner overnight indoor air across prolonged resting hours without relying on open-window drafts.',
    limitationsAndTradeoffs:
      'Closed bedrooms can feel stuffy if very small; crack an interior hallway door for interior circulation rather than opening street windows during smog.',
    practicalAlternative:
      'If indoor warmth builds up, briefly lower thermostat setback by 1–2°C instead of cracking exterior windows into smoky air.',
    informationBasis: aqState.isUnavailable ? 'qualitative_estimate' : 'model_derived',
  });

  drafts.push({
    id: 'night-next-day-prep',
    period: 'night',
    category: 'scheduling',
    title:
      betterTimeWindows.status === 'unavailable'
        ? 'Next-day hourly air-quality schedule check'
        : 'Pre-plan tomorrow’s consolidated trips and morning commute',
    status: betterTimeWindows.status === 'unavailable' ? 'unavailable' : 'optional',
    statusReason:
      betterTimeWindows.status === 'unavailable'
        ? 'Overnight forecast series is unavailable; check updated telemetry in the morning before locking outdoor times.'
        : 'Optional evening planning step to make low-emission choices effortless in the morning.',
    basePriority: 64,
    suggestedWindow: '21:30 – 22:30 local time',
    impactType: 'emission_reduction',
    whatToDo:
      betterTimeWindows.status === 'unavailable'
        ? 'Prepare tomorrow’s errands list now and refresh VAYORA air quality telemetry in the morning before deciding on outdoor exercise or active commutes.'
        : 'Pack transit passes or shared school-run items the night before and group tomorrow’s errands so morning rush-hour solo driving can be avoided.',
    whyRecommended:
      'Pre-planning prevents rushed morning solo vehicle trips and last-minute detour emissions.',
    influencingData: [
      `Saved commute mode: ${commuteLabel}`,
      `Guidance focus: ${profile.lifestylePreferences.preferredGuidanceFocus}`,
      `Forecast availability: ${betterTimeWindows.status}`,
    ],
    expectedBenefit:
      'Makes lower-emission commuting and single-loop errand scheduling practical on busy weekday mornings.',
    limitationsAndTradeoffs:
      'Morning wind or fog changes can shift overnight forecasts, so confirm current conditions before setting out.',
    practicalAlternative:
      'Keep a shared household errand list by the door to consolidate spontaneous trips.',
    informationBasis: betterTimeWindows.status === 'unavailable' ? 'unavailable' : 'rule_derived',
  });

  const finalizedItems = drafts.map((draft) =>
    finalizeItem(draft, aqState, profile.lifestylePreferences.preferredGuidanceFocus),
  );

  const periodOrder: readonly RoutineTimePeriod[] = ['morning', 'midday', 'evening', 'night'];
  const periods: RoutinePeriodGroup[] = periodOrder.map((period) => {
    const meta = ROUTINE_PERIOD_METADATA[period];
    const items = finalizedItems
      .filter((item) => item.period === period)
      .sort((a, b) => {
        const statusDiff = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }
        return b.priorityScore - a.priorityScore;
      });

    const recCount = items.filter((item) => item.status === 'recommended').length;
    const unavailCount = items.filter((item) => item.status === 'unavailable').length;

    let periodSummary = `${recCount} recommended ${recCount === 1 ? 'action' : 'actions'} tailored to your household profile.`;
    if (unavailCount > 0) {
      periodSummary += ` ${unavailCount} ${unavailCount === 1 ? 'action' : 'actions'} marked unavailable for safety or missing forecast data.`;
    }

    return {
      period,
      label: meta.label,
      windowHint: meta.windowHint,
      periodSummary,
      items,
    };
  });

  const totalRecommended = finalizedItems.filter((i) => i.status === 'recommended').length;
  const totalOptional = finalizedItems.filter((i) => i.status === 'optional').length;
  const totalUnavailable = finalizedItems.filter((i) => i.status === 'unavailable').length;
  const exposureCount = finalizedItems.filter((i) => i.impactType === 'exposure_reduction').length;
  const emissionCount = finalizedItems.filter((i) => i.impactType === 'emission_reduction').length;
  const bothCount = finalizedItems.filter((i) => i.impactType === 'both').length;

  let headline = `Daily Low-Emission Routine for ${profile.neighborhood}, ${profile.city}`;
  let summary = `Generated ${totalRecommended} recommended and ${totalOptional} optional actions across morning, midday, evening, and night based on ${profile.city} conditions and your ${commuteLabel.toLowerCase()} profile.`;

  if (aqState.isUnavailable) {
    headline = `Baseline Clean-Air Routine (Live Telemetry Unavailable) — ${profile.city}`;
    summary =
      'Live AQI and hourly forecast data are unavailable, so forecast-dependent scheduling is marked unavailable and general low-emission and exposure-precaution habits remain active.';
  } else if (aqState.isStale) {
    summary +=
      ' Note: Atmospheric inputs rely on stale cached model telemetry; verify fresher readings if weather shifts rapidly.';
  }

  return {
    periods,
    overview: {
      headline,
      summary,
      totalRecommended,
      totalOptional,
      totalUnavailable,
      exposureCount,
      emissionCount,
      bothCount,
      safetyAndScopeNotice:
        'Daily routines distinguish personal exposure reduction from neighborhood emission reduction and never treat them as interchangeable. Household composition groups guide practical scheduling only—never medical diagnosis or treatment. Air-quality values come from Open-Meteo model forecasts, not direct roadside monitors.',
    },
  };
}
