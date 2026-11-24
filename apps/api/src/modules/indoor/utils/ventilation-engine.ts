import type {
  BetterTimeWindowsSummary,
  HouseholdLifestyleRecord,
  IndoorScenarioId,
  VentilationGuidanceSummary,
} from '@uaqa/contracts';
import type { EvaluatedAirQualityState } from '../../routines/routines.types.ts';

export function buildVentilationGuidance(options: {
  readonly profile: HouseholdLifestyleRecord;
  readonly aqState: EvaluatedAirQualityState;
  readonly betterTimeWindows: BetterTimeWindowsSummary;
  readonly scenario: IndoorScenarioId;
}): VentilationGuidanceSummary {
  const { profile, aqState, betterTimeWindows, scenario } = options;

  const isSimulatedHighOutdoor = scenario === 'elevated_outdoor_pollution';
  const usesCombustionHeating =
    profile.heatingType === 'solid_fuel' || profile.heatingType === 'natural_gas';
  const usesMechanicalOrFilteredHvac =
    profile.ventilationContext === 'mechanical_hvac' ||
    profile.ventilationContext === 'filtered_hvac_merv13';

  const bestWindow = betterTimeWindows.windows[0] ?? null;
  const bestWindowHint = bestWindow
    ? `${bestWindow.label} (${bestWindow.dataBasis === 'stale_model_forecast' ? 'stale cached forecast' : 'Open-Meteo model forecast'})`
    : null;

  const windowDisclosure = betterTimeWindows.limitationDisclosure;

  const essentialSafetyReminder = usesCombustionHeating
    ? 'Never seal exterior vents, chimneys, flues, or combustion air intakes. Because your profile lists fuel-based heating, keep required fresh-air supply clear, follow appliance safety instructions, and maintain working carbon monoxide (CO) and smoke detectors.'
    : 'Never seal a home in a way that blocks essential kitchen/bathroom exhaust, moisture removal, or combustion appliance air supply. Follow local building ventilation standards and keep smoke and CO alarms active.';

  const constraintsAndTradeoffs: string[] = [
    'Outdoor air quality readings are model-derived estimates for your region, not indoor sensor measurements inside your home.',
    'Low outdoor pollution does not automatically guarantee safe indoor air if cooking smoke, chemical fumes, or combustion emissions build up indoors.',
  ];

  if (usesMechanicalOrFilteredHvac) {
    constraintsAndTradeoffs.push(
      'Standard mechanical HVAC intake draws outdoor air unless recirculation or high-efficiency particle filtration (MERV-13+) is active; inspect filter seal and manufacturer limits before altering system modes.',
    );
  }
  if (aqState.isStale) {
    constraintsAndTradeoffs.push(
      'Outdoor air telemetry is currently served from a stale cache; verify visible outdoor conditions before prolonged window airing.',
    );
  }

  // Case 1: Outdoor telemetry completely unavailable (unless user explicitly simulates elevated outdoor pollution)
  if (aqState.isUnavailable && !isSimulatedHighOutdoor) {
    return {
      state: 'insufficient_data',
      stateLabel: 'Indoor/outdoor data insufficient — cannot make a confident recommendation',
      headline: 'Outdoor telemetry unavailable for confident optional window timing',
      summary:
        'Live outdoor AQI and hourly dispersion forecasts could not be retrieved, and no indoor sensors are connected. VAYORA cannot verify whether outdoor air is cleaner than indoor air right now.',
      bestWindowHint: null,
      windowDisclosure,
      essentialSafetyReminder,
      constraintsAndTradeoffs: [
        ...constraintsAndTradeoffs,
        'No synthetic ventilation durations or clean-air windows are generated during telemetry outages.',
        ...(scenario === 'cooking' || scenario === 'cleaning'
          ? [
              'Active indoor emissions (cooking fumes or cleaning vapors) still require source exhaust or brief targeted airing even when outdoor data is unavailable.',
            ]
          : []),
      ],
      informationCategory: 'general_educational_guidance',
    };
  }

  // Case 2: High or very high outdoor pollution, or explicit elevated outdoor pollution simulation
  if (aqState.isHighOrWorse || isSimulatedHighOutdoor) {
    const contextLabel = isSimulatedHighOutdoor
      ? 'Simulated elevated outdoor pollution episode'
      : `Elevated outdoor pollution (${aqState.usAqiSnippet} · ${aqState.europeanAqiSnippet})`;

    const scenarioAdjustment =
      scenario === 'cooking' || scenario === 'cleaning'
        ? ' Because you selected an active indoor emission scenario, prioritize vented range hoods/bath exhaust first and use only brief, targeted airing if vapors or smoke accumulate.'
        : scenario === 'opening_windows'
          ? ' Under elevated outdoor pollution, keeping windows closed for optional cross-ventilation helps slow outdoor particulate entry while indoor particle sources are avoided.'
          : '';

    return {
      state: 'delay_optional_ventilation',
      stateLabel: 'Delay optional ventilation when outdoor pollution is elevated',
      headline: `Delay optional window airing during elevated outdoor smog (${isSimulatedHighOutdoor ? 'Simulation' : aqState.dominantLabel})`,
      summary: `${contextLabel} increases the likelihood of outdoor particles entering if windows stay open continuously.${scenarioAdjustment} Keep optional airing paused until outdoor dispersion improves, while preserving essential combustion and moisture ventilation.`,
      bestWindowHint: isSimulatedHighOutdoor ? null : bestWindowHint,
      windowDisclosure: isSimulatedHighOutdoor
        ? 'Simulation notice: elevated outdoor pollution scenario overrides live window recommendations to illustrate protective steps.'
        : windowDisclosure,
      essentialSafetyReminder,
      constraintsAndTradeoffs,
      informationCategory: isSimulatedHighOutdoor
        ? 'general_educational_guidance'
        : 'outdoor_air_quality',
    };
  }

  // Case 3: Moderate pollution, elevated specific pollutants (PM/NO2/O3/SO2/CO), or stale outdoor telemetry
  if (
    aqState.effectiveLevel === 'moderate' ||
    aqState.isStale ||
    aqState.isPmElevated ||
    aqState.isOzoneElevated ||
    aqState.isNo2Elevated ||
    aqState.isSo2Elevated ||
    aqState.isCoElevated ||
    scenario === 'cleaning' ||
    scenario === 'cooking'
  ) {
    const pollutantNote = aqState.isOzoneElevated
      ? ' Ground-level ozone (O3) often peaks during sunlit afternoon hours; prefer cooler, lower-ozone intervals.'
      : aqState.isNo2Elevated
        ? ' Roadway nitrogen dioxide (NO2) is elevated; avoid opening street-facing windows during rush hours.'
        : aqState.isPmElevated
          ? ' Particulate concentrations (PM2.5/PM10) are elevated; keep window airing brief and monitor outdoor dispersion.'
          : aqState.isSo2Elevated || aqState.isCoElevated
            ? ' Combustion-related gas concentrations are elevated; prefer brief cross-ventilation away from traffic or smoke plumes.'
            : '';

    const activityNote =
      scenario === 'cleaning'
        ? ' When using cleaning agents, prioritize airing out chemical vapors on the non-traffic side of the home rather than keeping fumes trapped indoors.'
        : scenario === 'cooking'
          ? ' Use an external-venting range hood if available, or crack a window briefly on the quieter side of the home while cooking.'
          : '';

    return {
      state: 'shorter_timed_ventilation',
      stateLabel: 'Prefer a shorter or more carefully timed ventilation period',
      headline: `Use brief, selectively timed ventilation (${aqState.effectiveLevel === 'low' ? 'active indoor source' : aqState.dominantLabel})`,
      summary: `Current outdoor conditions (${aqState.usAqiSnippet}) call for selective timing rather than leaving street-facing windows open all day.${pollutantNote}${activityNote}`,
      bestWindowHint,
      windowDisclosure,
      essentialSafetyReminder,
      constraintsAndTradeoffs,
      informationCategory: 'outdoor_air_quality',
    };
  }

  // Case 4: Low outdoor pollution and fresh forecast
  return {
    state: 'consider_ventilation',
    stateLabel: 'Consider ventilation when conditions are favourable',
    headline: 'Outdoor model conditions are comparatively favourable for airing out',
    summary: `Fresh outdoor model telemetry (${aqState.usAqiSnippet} · ${aqState.europeanAqiSnippet}) indicates comparatively low regional pollution. Refreshing indoor air can help dilute indoor moisture, cooking odors, and everyday vapors—while keeping roadside idling or nearby chimney smoke in mind.`,
    bestWindowHint,
    windowDisclosure,
    essentialSafetyReminder,
    constraintsAndTradeoffs: [
      ...constraintsAndTradeoffs,
      'Regional models may miss localized pollution right outside your window (such as nearby vehicle exhaust, wood-smoke chimneys, or construction dust).',
    ],
    informationCategory: 'outdoor_air_quality',
  };
}
