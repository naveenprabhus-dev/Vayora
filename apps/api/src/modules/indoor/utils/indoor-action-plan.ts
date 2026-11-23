import type {
  BetterTimeWindowsSummary,
  HouseholdLifestyleRecord,
  IndoorActionPlanItem,
  IndoorScenarioId,
  IndoorScenarioSummary,
} from '@uaqa/contracts';
import type { EvaluatedAirQualityState } from '../../routines/routines.types.ts';
import { INDOOR_SCENARIO_OPTIONS } from '../indoor.constants.ts';

function getCategoryLabel(category: IndoorActionPlanItem['informationCategory']): string {
  switch (category) {
    case 'outdoor_air_quality':
      return 'Outdoor air-quality information';
    case 'estimated_inferred_indoor':
      return 'Estimated / inferred indoor context';
    case 'general_educational_guidance':
      return 'General educational guidance';
  }
}

export function buildScenarioSummary(scenario: IndoorScenarioId): IndoorScenarioSummary {
  const isSimulation = scenario !== 'baseline';

  const detailsByScenario: Readonly<
    Record<
      IndoorScenarioId,
      {
        readonly title: string;
        readonly description: string;
        readonly focusNotes: readonly string[];
      }
    >
  > = {
    baseline: {
      title: 'Saved household indoor environment',
      description:
        'Evaluates ventilation timing, filtration, combustion safety, and indoor source control using your saved household settings and outdoor air conditions.',
      focusNotes: [
        'Uses your saved ventilation setup, purifier availability, and heating type without altering saved preferences.',
        'All indoor conditions are qualitatively inferred rather than measured because no indoor sensors are connected.',
      ],
    },
    cooking: {
      title: 'Simulation: Cooking at home',
      description:
        'Explores practical ways to capture grease aerosols, steam, and combustion gases while balancing outdoor air quality.',
      focusNotes: [
        'Prioritizes vented range-hood exhaust (if installed), pot lids, and moderate cooking heat.',
        'Highlights why portable HEPA purifiers alone do not remove stove combustion gases such as NO2 or CO.',
      ],
    },
    cleaning: {
      title: 'Simulation: Cleaning the house',
      description:
        'Explores how surface disinfectants, sprays, and dust resuspension affect indoor air and safe ventilation steps.',
      focusNotes: [
        'Emphasizes liquid application on cloths over aerosol misting and damp mopping over dry sweeping.',
        'Includes strict chemical safety notice: never mix bleach with ammonia, vinegar, or acidic cleaners.',
      ],
    },
    opening_windows: {
      title: 'Simulation: Opening windows',
      description:
        'Inspects trade-offs between natural fresh-air exchange and outdoor smog infiltration under current model telemetry.',
      focusNotes: [
        'Compares outdoor US/European AQI and hourly dispersion windows before suggesting optional airing.',
        'Reminds household members to keep essential kitchen, bathroom, and fuel-appliance air supply unobstructed.',
      ],
    },
    operating_purifier: {
      title: 'Simulation: Operating an air purifier',
      description:
        'Explores practical room placement, filter maintenance, door/window awareness, and particle-vs-gas boundaries.',
      focusNotes: [
        'Clarifies that HEPA media captures fine particles (PM2.5/dust) but does not remove CO or all VOC vapors.',
        'Outcomes are qualitative guidance only, not measured indoor CADR removal rates.',
      ],
    },
    elevated_outdoor_pollution: {
      title: 'Simulation: Experiencing elevated outdoor pollution',
      description:
        'Simulates an elevated outdoor winter-smog episode to inspect how household ventilation and indoor activity habits adapt.',
      focusNotes: [
        'Pauses optional street-facing window airing while keeping safety ventilation and CO precautions intact.',
        'Prioritizes avoiding extra indoor combustion (candles, incense, indoor smoke) while outdoor dispersion is poor.',
      ],
    },
  };

  const selected = detailsByScenario[scenario];

  return {
    selectedScenario: scenario,
    isSimulation,
    simulationLabel: isSimulation
      ? 'Simulated activity scenario — illustrative qualitative guidance only, not measured indoor readings or guaranteed health outcomes.'
      : 'Baseline guidance derived from your saved household profile and current outdoor context.',
    scenarioTitle: selected.title,
    scenarioDescription: selected.description,
    scenarioFocusNotes: selected.focusNotes,
    availableScenarios: INDOOR_SCENARIO_OPTIONS,
  };
}

export function buildPersonalizedIndoorActionPlan(options: {
  readonly profile: HouseholdLifestyleRecord;
  readonly aqState: EvaluatedAirQualityState;
  readonly betterTimeWindows: BetterTimeWindowsSummary;
  readonly scenario: IndoorScenarioId;
}): readonly IndoorActionPlanItem[] {
  const { profile, aqState, betterTimeWindows, scenario } = options;
  const items: IndoorActionPlanItem[] = [];

  const usesCombustionHeating =
    profile.heatingType === 'solid_fuel' || profile.heatingType === 'natural_gas';
  const usesHvac =
    profile.ventilationContext === 'mechanical_hvac' ||
    profile.ventilationContext === 'filtered_hvac_merv13';
  const hasPurifierContext =
    profile.hasIndoorAirPurifier ||
    profile.ventilationContext === 'portable_hepa_only' ||
    scenario === 'operating_purifier';
  const isHighOutdoorOrSim = aqState.isHighOrWorse || scenario === 'elevated_outdoor_pollution';
  const bestWindow = betterTimeWindows.windows[0]?.label ?? null;

  // 1. Ventilation & Outdoor Timing Action (always relevant, adapts cleanly to availability & scenario)
  const ventilationStatus =
    aqState.isUnavailable && scenario !== 'elevated_outdoor_pollution'
      ? ('caution' as const)
      : isHighOutdoorOrSim
        ? ('caution' as const)
        : ('recommended' as const);

  const ventilationCategory: IndoorActionPlanItem['informationCategory'] =
    scenario === 'elevated_outdoor_pollution' || aqState.isUnavailable
      ? 'general_educational_guidance'
      : 'outdoor_air_quality';

  items.push({
    id: 'indoor-ventilation-timing',
    title: isHighOutdoorOrSim
      ? 'Pause optional street-facing window airing during elevated outdoor smog'
      : aqState.isUnavailable
        ? 'Use cautious manual checks while outdoor telemetry is unavailable'
        : bestWindow
          ? `Time brief optional airing around lower outdoor window (${bestWindow})`
          : 'Check outdoor conditions before prolonged optional window airing',
    status: ventilationStatus,
    statusLabel:
      ventilationStatus === 'caution' ? 'Caution / targeted timing' : 'Recommended practice',
    priorityScore: scenario === 'opening_windows' || isHighOutdoorOrSim ? 98 : 88,
    informationCategory: ventilationCategory,
    informationCategoryLabel: getCategoryLabel(ventilationCategory),
    whatToDo: isHighOutdoorOrSim
      ? 'Keep street-facing windows shut for optional cross-breezes during elevated outdoor smog, and prioritize essential local exhaust (kitchen/bath) when moisture or cooking fumes build up.'
      : aqState.isUnavailable
        ? 'Because outdoor AQI cannot be verified right now, avoid assuming outdoor air is clean; use brief targeted airing only for active indoor moisture, cooking steam, or chemical odors.'
        : 'Keep optional airing short and favor windows facing courtyards or away from busy roadways; watch for visible neighborhood wood smoke or traffic idling before opening wide.',
    whyRecommended: isHighOutdoorOrSim
      ? 'Elevated outdoor fine particles (PM2.5) gradually infiltrate indoors through wide-open windows.'
      : 'Model-derived outdoor conditions and household ventilation settings shape how much outdoor pollution enters during airing.',
    householdAndOutdoorContext: [
      `Saved ventilation setup: ${profile.ventilationContext.replaceAll('_', ' ')}`,
      aqState.isUnavailable
        ? 'Outdoor telemetry: Unavailable (no synthetic values shown)'
        : `Outdoor model context: ${aqState.usAqiSnippet}`,
    ],
    precautionAndSafety:
      'Never seal exterior appliance vents, flues, or safety air intakes; follow building safety instructions for fresh-air requirements.',
    limitations:
      'No fixed universal minute duration is prescribed because actual air-exchange rate depends on wind, temperature difference, and window geometry.',
    highlightedByScenario:
      scenario === 'opening_windows' || scenario === 'elevated_outdoor_pollution',
  });

  // 2. Cooking Exhaust & Particle Control (relevant for all households, elevated on cooking scenario or purifier/indoor focus)
  items.push({
    id: 'indoor-cooking-exhaust',
    title: 'Capture cooking steam and aerosols at the source',
    status: 'recommended',
    statusLabel: 'Recommended practice',
    priorityScore:
      scenario === 'cooking'
        ? 99
        : profile.lifestylePreferences.preferredGuidanceFocus === 'indoor_air'
          ? 86
          : 78,
    informationCategory: 'general_educational_guidance',
    informationCategoryLabel: getCategoryLabel('general_educational_guidance'),
    whatToDo:
      'Turn on an external-venting kitchen exhaust fan (if installed) before heating oils, cook on back burners, cover pots with lids, and keep cooking temperatures below oil smoke points when possible.',
    whyRecommended:
      'Everyday frying and searing generate short, concentrated bursts of indoor fine particles and—with gas stoves—combustion gases regardless of outdoor AQI.',
    householdAndOutdoorContext: [
      `Household size: ${profile.householdSize} ${profile.householdSize === 1 ? 'person' : 'people'}`,
      'Even when outdoor AQI is low, indoor cooking plumes can degrade kitchen air quickly.',
    ],
    precautionAndSafety:
      'Never use a gas oven or stovetop to heat living spaces, and remember that ductless recirculating hoods do not vent CO or NO2 outdoors.',
    limitations:
      'Effectiveness depends on whether your kitchen has an outdoor-vented hood versus a recirculating filter.',
    highlightedByScenario: scenario === 'cooking',
  });

  // 3. HEPA Purifier Operation & Maintenance (only when household has purifier or simulates operating one)
  if (hasPurifierContext) {
    const isSimulated = !profile.hasIndoorAirPurifier && scenario === 'operating_purifier';
    items.push({
      id: 'indoor-hepa-operation-maintenance',
      title: isSimulated
        ? 'Simulated HEPA purifier operation, room placement & filter upkeep'
        : 'Operate and maintain your HEPA air purifier within particle-only limits',
      status: isSimulated ? 'optional' : 'recommended',
      statusLabel: isSimulated ? 'Simulated option' : 'Recommended for your setup',
      priorityScore: scenario === 'operating_purifier' ? 97 : isHighOutdoorOrSim ? 92 : 84,
      informationCategory: isSimulated
        ? 'general_educational_guidance'
        : 'estimated_inferred_indoor',
      informationCategoryLabel: getCategoryLabel(
        isSimulated ? 'general_educational_guidance' : 'estimated_inferred_indoor',
      ),
      whatToDo:
        'Run the unit in an occupied room matched to its manufacturer room-size rating, keep nearby exterior windows closed while filtering particles, vacuum pre-filters gently if recommended, and replace HEPA cartridges on schedule.',
      whyRecommended:
        'Consistent fan operation in an enclosed room helps trap airborne fine dust and smoke soot when outdoor smog or dust resuspension rises.',
      householdAndOutdoorContext: [
        isSimulated
          ? 'Scenario simulation: Household profile does not report owning a purifier'
          : 'Household profile reports indoor air purifier / HEPA room setup',
        `Zone context: ${profile.locationPreferences.primaryZoneType.replaceAll('_', ' ')}`,
      ],
      precautionAndSafety:
        'Follow manufacturer maintenance instructions and avoid uncertified ozone-generating "ionizer" modes that can produce indoor ozone.',
      limitations:
        'HEPA media filters airborne particles only; it does NOT remove carbon monoxide (CO), nitrogen dioxide (NO2), or all cleaning-product VOC gases.',
      highlightedByScenario: scenario === 'operating_purifier',
    });
  }

  // 4. HVAC Filter Fit & Inspection (only when household reports mechanical or filtered HVAC)
  if (usesHvac) {
    items.push({
      id: 'indoor-hvac-filter-check',
      title: 'Check central HVAC filter seating and manufacturer pressure rating',
      status: 'recommended',
      statusLabel: 'Recommended for your setup',
      priorityScore: 82,
      informationCategory: 'estimated_inferred_indoor',
      informationCategoryLabel: getCategoryLabel('estimated_inferred_indoor'),
      whatToDo:
        'Inspect your HVAC return filter slot for air gaps around the frame and replace dirty filters on the schedule approved in your HVAC system manual.',
      whyRecommended:
        'Gaps around a filter allow dusty air to bypass the media completely, while overly dense filters on unrated blowers can strain equipment.',
      householdAndOutdoorContext: [
        `Saved ventilation context: ${profile.ventilationContext.replaceAll('_', ' ')}`,
      ],
      precautionAndSafety:
        'Consult your building manager or HVAC manual before upgrading filter MERV ratings to avoid restricting airflow.',
      limitations:
        'Central air systems only filter air when the system fan is actively circulating air through the return ducts.',
      highlightedByScenario: scenario === 'elevated_outdoor_pollution',
    });
  }

  // 5. Cleaning Products, Chemical Mixing Safety & Damp Dust Capture
  items.push({
    id: 'indoor-cleaning-chemical-safety',
    title: 'Use damp dusting and low-spray cleaning without mixing chemicals',
    status: scenario === 'cleaning' ? 'caution' : 'recommended',
    statusLabel: scenario === 'cleaning' ? 'Safety precaution' : 'Recommended practice',
    priorityScore: scenario === 'cleaning' ? 99 : 74,
    informationCategory: 'general_educational_guidance',
    informationCategoryLabel: getCategoryLabel('general_educational_guidance'),
    whatToDo:
      'Wipe floors and shelves with damp microfiber cloths rather than dry brooms, pour or dab liquid cleaners onto cloths instead of spraying aerosols into the air, and air out the room while strong cleaners dry.',
    whyRecommended:
      'Aerosol sprays and dry sweeping inject chemical droplets and settled dust back into breathing height indoors.',
    householdAndOutdoorContext: [
      ...(profile.householdComposition.includes('young_children') ||
      profile.householdComposition.includes('pets')
        ? ['Household includes young children or pets near floor-level settled dust']
        : ['Applies to routine indoor surface and floor maintenance']),
    ],
    precautionAndSafety:
      'CRITICAL: Never mix chlorine bleach with ammonia, vinegar, or acidic toilet/drain cleaners; combining products releases hazardous gases. Follow label ventilation warnings.',
    limitations:
      'Damp cleaning reduces resuspended dust only temporarily if tracked-in dirt or indoor smoke sources continue.',
    highlightedByScenario: scenario === 'cleaning',
  });

  // 6. Combustion Appliance Safety & Maintenance (essential & prioritized when gas/solid-fuel heating is saved)
  if (usesCombustionHeating || scenario === 'elevated_outdoor_pollution') {
    items.push({
      id: 'indoor-combustion-appliance-safety',
      title: usesCombustionHeating
        ? 'Maintain fuel-burning heating appliances and verify working CO alarms'
        : 'Avoid indoor smoke sources and keep safety alarms active',
      status: usesCombustionHeating ? 'caution' : 'recommended',
      statusLabel: usesCombustionHeating ? 'Essential safety check' : 'Recommended practice',
      priorityScore: usesCombustionHeating ? 96 : 80,
      informationCategory: usesCombustionHeating
        ? 'estimated_inferred_indoor'
        : 'general_educational_guidance',
      informationCategoryLabel: getCategoryLabel(
        usesCombustionHeating ? 'estimated_inferred_indoor' : 'general_educational_guidance',
      ),
      whatToDo: usesCombustionHeating
        ? 'Ensure annual qualified servicing of furnaces, boilers, stoves, and chimneys; verify exterior exhaust pipes are clear of snow or debris; test battery-backed carbon monoxide (CO) and smoke alarms monthly; use dry, seasoned fuel only if using a solid-fuel stove.'
        : 'Avoid burning candles, incense, or indoor smoke sources—especially when outdoor pollution keeps windows closed—and confirm smoke and CO alarms have working batteries.',
      whyRecommended: usesCombustionHeating
        ? 'Fuel-burning heating appliances can leak odorless carbon monoxide (CO) and nitrogen dioxide if flues clog or combustion is incomplete.'
        : 'With windows closed during winter smog, minor indoor combustion like candles or incense lingers longer in living spaces.',
      householdAndOutdoorContext: [
        `Saved heating type: ${profile.heatingType.replaceAll('_', ' ')}`,
      ],
      precautionAndSafety:
        'Never run portable fuel generators, charcoal grills, or unvented fuel heaters indoors or in attached garages. Exit immediately if a CO alarm triggers.',
      limitations:
        'Software guidance cannot inspect mechanical flues or detect CO leaks; physical certified alarms and licensed technicians are essential.',
      highlightedByScenario: scenario === 'elevated_outdoor_pollution',
    });
  } else {
    // Non-combustion households still benefit from avoiding candles/incense/tobacco smoke indoors
    items.push({
      id: 'indoor-avoid-unnecessary-smoke',
      title: 'Keep indoor rooms free from tobacco smoke, incense, and candles',
      status: 'recommended',
      statusLabel: 'Recommended practice',
      priorityScore: 76,
      informationCategory: 'general_educational_guidance',
      informationCategoryLabel: getCategoryLabel('general_educational_guidance'),
      whatToDo:
        'Keep smoking outside and away from open doors/windows, and replace decorative candles or incense with flameless LED lighting during stagnant winter days.',
      whyRecommended:
        'Even small decorative combustion sources release fine soot particles directly into closed indoor rooms.',
      householdAndOutdoorContext: [
        `Saved heating type: ${profile.heatingType.replaceAll('_', ' ')} (non-combustion primary heating)`,
      ],
      precautionAndSafety:
        'Always verify building smoke and CO alarms remain operational regardless of primary heating type.',
      limitations:
        'Eliminating indoor smoke prevents indoor particulate spikes, though outdoor infiltration can still occur.',
      highlightedByScenario: false,
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore);
}
