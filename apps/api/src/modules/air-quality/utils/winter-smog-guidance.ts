import type {
  AqiReadingSummary,
  DominantPollutantSummary,
  GuidanceActionItem,
  HouseholdLifestyleRecord,
  PollutionLevelBand,
  WinterSmogGuidance,
} from '@uaqa/contracts';

const LEVEL_RANK: Readonly<Record<PollutionLevelBand, number>> = {
  unavailable: -1,
  low: 0,
  moderate: 1,
  high: 2,
  very_high: 3,
};

function selectConservativePollutionLevel(
  usAqi: AqiReadingSummary,
  europeanAqi: AqiReadingSummary,
): PollutionLevelBand {
  const usRank = LEVEL_RANK[usAqi.pollutionLevel];
  const euRank = LEVEL_RANK[europeanAqi.pollutionLevel];
  if (usRank < 0 && euRank < 0) {
    return 'unavailable';
  }
  return usRank >= euRank ? usAqi.pollutionLevel : europeanAqi.pollutionLevel;
}

export function buildWinterSmogGuidance(options: {
  readonly usAqi: AqiReadingSummary;
  readonly europeanAqi: AqiReadingSummary;
  readonly dominantPollutant: DominantPollutantSummary;
  readonly isStale: boolean;
  readonly householdProfile?: HouseholdLifestyleRecord | null | undefined;
}): WinterSmogGuidance {
  const level = selectConservativePollutionLevel(options.usAqi, options.europeanAqi);
  const dominantLabel = options.dominantPollutant.abbreviation ?? 'airborne particulates';
  const hasPurifier = options.householdProfile?.hasIndoorAirPurifier ?? false;
  const usesSolidFuel = options.householdProfile?.heatingType === 'solid_fuel';

  const fogDistinctionNote =
    'Cold air or ordinary water-vapor fog alone does not mean winter smog is high. Smog depends on trapped particulate matter (PM2.5/PM10) and combustion gases (NO2/SO2) shown in the measurements above.';

  const guidanceScopeNote =
    'General evidence-based air quality guidance derived from current telemetry and saved household context. Individualized AI daily routines will be introduced in later modules.';

  if (level === 'unavailable') {
    return {
      status: 'general_precaution',
      headline: 'General Clean-Air Precautions (Live Readings Unavailable)',
      summary:
        'Live air quality measurements could not be verified right now. Use these baseline clean-air practices without assuming high or low local pollution.',
      fogDistinctionNote,
      guidanceScopeNote,
      actions: [
        {
          id: 'general-check-conditions',
          category: 'outdoor_activity',
          title: 'Observe visible haze and traffic corridors',
          recommendation:
            'When walking or exercising outdoors, favor side streets and parks away from idling vehicle lanes during peak commute hours.',
          evidenceBasis: 'General exposure-reduction principle when live telemetry is unavailable.',
        },
        {
          id: 'general-ventilation',
          category: 'ventilation',
          title: 'Time short indoor ventilation thoughtfully',
          recommendation:
            'Brief cross-ventilation works best during midday breeze hours when traffic emissions and smoke odors are lowest.',
          evidenceBasis: 'General indoor-outdoor air exchange best practice.',
        },
        {
          id: 'general-indoor-sources',
          category: 'household',
          title: 'Reduce indoor combustion particles',
          recommendation:
            'Run kitchen exhaust fans while cooking and minimize unnecessary candle, incense, or unvented combustion indoors.',
          evidenceBasis: 'Baseline indoor particulate control regardless of outdoor levels.',
        },
      ],
    };
  }

  const status = options.isStale ? 'stale_evidence' : 'measured_evidence';

  if (level === 'low') {
    return {
      status,
      headline: 'Favorable Dispersion — Low Exposure Precautions Needed',
      summary: `Current indicators show low pollutant buildup${
        options.isStale ? ' (based on most recent cached reading)' : ''
      }. Standard outdoor routines and natural airing are supported.`,
      fogDistinctionNote,
      guidanceScopeNote,
      actions: [
        {
          id: 'low-outdoor',
          category: 'outdoor_activity',
          title: 'Normal outdoor routines supported',
          recommendation:
            'Walking, cycling, and outdoor family activities can proceed as usual; keep monitoring forecasts ahead of calm evening temperature drops.',
          evidenceBasis: `US AQI: ${options.usAqi.category}; European AQI: ${options.europeanAqi.category}.`,
        },
        {
          id: 'low-ventilation',
          category: 'ventilation',
          title: 'Refresh indoor air during clean periods',
          recommendation:
            'Open windows briefly for fresh air exchange while dispersion remains favorable.',
          evidenceBasis: 'Low ambient particulate and gas concentrations.',
        },
        {
          id: 'low-commute',
          category: 'commute',
          title: 'Sustain low-emission habits',
          recommendation:
            'Choosing walking, cycling, or public transit keeps neighborhood combustion emissions low ahead of evening cooling.',
          evidenceBasis: 'Preventive community emissions reduction.',
        },
      ],
    };
  }

  if (level === 'moderate') {
    const actions: GuidanceActionItem[] = [
      {
        id: 'mod-outdoor',
        category: 'outdoor_activity',
        title: 'Adjust timing for prolonged outdoor exercise',
        recommendation:
          'Schedule extended outdoor runs or active play during midday hours rather than calm early morning or evening rush hours.',
        evidenceBasis: `Moderate pollution level driven by ${dominantLabel}.`,
      },
      {
        id: 'mod-ventilation',
        category: 'ventilation',
        title: 'Ventilate briefly outside peak traffic hours',
        recommendation: hasPurifier
          ? 'Keep street-facing windows closed during peak traffic and use your HEPA purifier on medium setting.'
          : 'Ventilate rooms briefly during lower-traffic windows and close windows near busy roads during commute peaks.',
        evidenceBasis: `Saved ventilation context and moderate ${dominantLabel} level.`,
      },
      {
        id: 'mod-commute',
        category: 'commute',
        title: 'Select lower-traffic side routes',
        recommendation:
          'Walking or cycling one block off major arterial roads substantially lowers direct tailpipe NO2 and PM exposure.',
        evidenceBasis: 'Roadside pollutant gradient near combustion corridors.',
      },
    ];

    if (usesSolidFuel) {
      actions.push({
        id: 'mod-heating',
        category: 'household',
        title: 'Use dry fuel and clean burn practices',
        recommendation:
          'If heating with solid fuel, burn only dry seasoned fuel with proper airflow to keep indoor and neighborhood particulate smoke minimal.',
        evidenceBasis: 'Household solid-fuel heating profile and moderate local smog.',
      });
    }

    return {
      status,
      headline: `Moderate Air Pollution — Targeted Exposure Steps (${dominantLabel})`,
      summary: `Pollutant concentrations sit in the moderate band${
        options.isStale ? ' (from cached model data)' : ''
      }. Proportionate routing and ventilation adjustments help keep household exposure low.`,
      fogDistinctionNote,
      guidanceScopeNote,
      actions,
    };
  }

  // high or very_high
  const actions: GuidanceActionItem[] = [
    {
      id: 'high-outdoor',
      category: 'outdoor_activity',
      title: 'Shift strenuous outdoor activity indoors',
      recommendation:
        'Limit prolonged high-exertion outdoor routines for children, older adults, and sensitive household members until hourly forecasts dip.',
      evidenceBasis: `Elevated ${dominantLabel} with ${options.usAqi.category} / ${options.europeanAqi.category} classification.`,
    },
    {
      id: 'high-ventilation',
      category: 'ventilation',
      title: 'Keep windows sealed and filter indoor air',
      recommendation: hasPurifier
        ? 'Close exterior windows during peak smog hours and run your HEPA air purifier continuously in primary living and sleeping rooms.'
        : 'Close exterior windows during peak inversion hours, switch HVAC systems to recirculation mode if available, and reduce indoor smoke sources.',
      evidenceBasis: 'Preventing outdoor particulate infiltration during high-pollution periods.',
    },
    {
      id: 'high-exposure',
      category: 'exposure_reduction',
      title: 'Consider well-fitted particulate protection for essential errands',
      recommendation:
        'If extended outdoor time along busy corridors is unavoidable, a well-fitting N95/FFP2 respirator reduces particulate inhalation.',
      evidenceBasis: `High particulate/smog conditions (${dominantLabel}).`,
    },
    {
      id: 'high-commute',
      category: 'commute',
      title: 'Consolidate trips and avoid engine idling',
      recommendation:
        'Combine essential errands, use public transit or lower-emission options where practical, and never idle vehicles near schools or home entrances.',
      evidenceBasis: 'Reducing personal exposure and neighborhood emission accumulation.',
    },
  ];

  return {
    status,
    headline: `Elevated Smog Alert — Active Exposure Reduction (${dominantLabel})`,
    summary: `Measurements show ${
      level === 'very_high' ? 'very high' : 'high'
    } pollutant concentrations${
      options.isStale ? ' (from most recent cached snapshot)' : ''
    }. Prioritize filtered indoor air and shorter outdoor exposure.`,
    fogDistinctionNote,
    guidanceScopeNote,
    actions,
  };
}
