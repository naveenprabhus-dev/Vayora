import type { AqiReadingSummary, DominantPollutantSummary, PollutantCode } from '@uaqa/contracts';
import {
  EPA_CO_8HR_PPM_BREAKPOINTS,
  EPA_NO2_1HR_PPB_BREAKPOINTS,
  EPA_O3_8HR_PPB_BREAKPOINTS,
  EPA_PM10_BREAKPOINTS,
  EPA_PM25_BREAKPOINTS,
  EPA_SO2_1HR_PPB_BREAKPOINTS,
  GAS_CONVERSION_FACTORS,
  POLLUTANT_CATALOG,
  type BreakpointRange,
} from '../air-quality.constants.ts';
import type { NormalizedCurrentReading } from '../air-quality.types.ts';

function computeLinearSubIndex(
  concentration: number,
  breakpoints: readonly BreakpointRange[],
): number | null {
  if (!Number.isFinite(concentration) || concentration < 0) {
    return null;
  }

  for (const bp of breakpoints) {
    if (concentration >= bp.cLow && concentration <= bp.cHigh) {
      const ratio = (bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow);
      return Math.round(ratio * (concentration - bp.cLow) + bp.iLow);
    }
  }

  const last = breakpoints[breakpoints.length - 1];
  if (last && concentration > last.cHigh) {
    return last.iHigh;
  }

  return null;
}

/**
 * Computes individual US EPA pollutant-specific AQI sub-indices strictly for
 * identifying the leading pollutant driver. Never averages concentrations or
 * fabricates an overall AQI when the provider AQI is missing.
 */
export function computeEpaPollutantSubIndex(
  code: PollutantCode,
  ugPerM3: number | null,
): number | null {
  if (ugPerM3 === null || !Number.isFinite(ugPerM3) || ugPerM3 < 0) {
    return null;
  }

  switch (code) {
    case 'pm2_5': {
      const truncated = Math.floor(ugPerM3 * 10) / 10;
      return computeLinearSubIndex(truncated, EPA_PM25_BREAKPOINTS);
    }
    case 'pm10': {
      const truncated = Math.floor(ugPerM3);
      return computeLinearSubIndex(truncated, EPA_PM10_BREAKPOINTS);
    }
    case 'o3': {
      const ppb = Math.floor(ugPerM3 / GAS_CONVERSION_FACTORS.o3UgPerM3PerPpb);
      return computeLinearSubIndex(ppb, EPA_O3_8HR_PPB_BREAKPOINTS);
    }
    case 'no2': {
      const ppb = Math.floor(ugPerM3 / GAS_CONVERSION_FACTORS.no2UgPerM3PerPpb);
      return computeLinearSubIndex(ppb, EPA_NO2_1HR_PPB_BREAKPOINTS);
    }
    case 'so2': {
      const ppb = Math.floor(ugPerM3 / GAS_CONVERSION_FACTORS.so2UgPerM3PerPpb);
      return computeLinearSubIndex(ppb, EPA_SO2_1HR_PPB_BREAKPOINTS);
    }
    case 'co': {
      const ppm = Math.floor((ugPerM3 / GAS_CONVERSION_FACTORS.coUgPerM3PerPpm) * 10) / 10;
      return computeLinearSubIndex(ppm, EPA_CO_8HR_PPM_BREAKPOINTS);
    }
  }
}

export function interpretUsAqi(value: number | null): AqiReadingSummary {
  const baseMeta = {
    scale: 'us_aqi' as const,
    scaleLabel: 'US AQI (EPA)',
    authorityLabel: 'U.S. EPA 0–500 Scale (40 CFR Part 58 Appendix G)',
    methodologyNote:
      'US AQI reports the highest individual pollutant index on a 0–500 scale rather than averaging pollutants together.',
  };

  if (value === null || !Number.isFinite(value) || value < 0) {
    return {
      ...baseMeta,
      value: null,
      status: 'unavailable',
      category: 'Unavailable',
      pollutionLevel: 'unavailable',
      pollutionLevelLabel: 'Unavailable',
      severityToken: 'unavailable',
      meaning: 'Current US AQI data could not be interpreted reliably from the provider response.',
      precautionSummary:
        'Verify local conditions before extended outdoor exertion and follow general clean-air habits until telemetry resumes.',
    };
  }

  const rounded = Math.round(value);
  if (rounded <= 50) {
    return {
      ...baseMeta,
      value: rounded,
      status: 'available',
      category: 'Good',
      pollutionLevel: 'low',
      pollutionLevelLabel: 'Low pollution level',
      severityToken: 'good',
      meaning:
        'Air quality is satisfactory with minimal expected pollution risk for daily routines.',
      precautionSummary: 'Normal outdoor activities and standard home ventilation are appropriate.',
    };
  }
  if (rounded <= 100) {
    return {
      ...baseMeta,
      value: rounded,
      status: 'available',
      category: 'Moderate',
      pollutionLevel: 'moderate',
      pollutionLevelLabel: 'Moderate pollution level',
      severityToken: 'moderate',
      meaning:
        'Air quality is acceptable, though unusually sensitive individuals may prefer shorter peak-traffic outdoor exposure.',
      precautionSummary:
        'Consider shifting strenuous outdoor workouts away from busy roads and keep filtration ready.',
    };
  }
  if (rounded <= 150) {
    return {
      ...baseMeta,
      value: rounded,
      status: 'available',
      category: 'Unhealthy for Sensitive Groups',
      pollutionLevel: 'moderate',
      pollutionLevelLabel: 'Moderate–elevated pollution level',
      severityToken: 'elevated',
      meaning:
        'Children, older adults, and households spending prolonged time outdoors face elevated particulate or gas exposure.',
      precautionSummary:
        'Shorten prolonged outdoor exertion, close street-facing windows during peak traffic, and run indoor HEPA filtration if available.',
    };
  }
  if (rounded <= 200) {
    return {
      ...baseMeta,
      value: rounded,
      status: 'available',
      category: 'Unhealthy',
      pollutionLevel: 'high',
      pollutionLevelLabel: 'High pollution level',
      severityToken: 'high',
      meaning:
        'Everyone may begin to experience noticeable air pollution exposure during extended outdoor activity.',
      precautionSummary:
        'Move strenuous activity indoors, minimize idling or open burning, and prioritize recirculated filtered indoor air.',
    };
  }
  if (rounded <= 300) {
    return {
      ...baseMeta,
      value: rounded,
      status: 'available',
      category: 'Very Unhealthy',
      pollutionLevel: 'very_high',
      pollutionLevelLabel: 'Very high pollution level',
      severityToken: 'very_high',
      meaning:
        'High particulate or smog build-up creates widespread outdoor exposure risks across all age groups.',
      precautionSummary:
        'Avoid unnecessary outdoor exertion, keep windows sealed during peak inversion hours, and run indoor air purification continuously.',
    };
  }

  return {
    ...baseMeta,
    value: rounded,
    status: 'available',
    category: 'Hazardous',
    pollutionLevel: 'very_high',
    pollutionLevelLabel: 'Severe pollution level',
    severityToken: 'very_high',
    meaning:
      'Extreme pollution levels require immediate outdoor exposure reduction for all households.',
    precautionSummary:
      'Stay indoors with filtered air recirculation, suspend outdoor routines, and reduce any indoor combustion sources.',
  };
}

export function interpretEuropeanAqi(value: number | null): AqiReadingSummary {
  const baseMeta = {
    scale: 'european_aqi' as const,
    scaleLabel: 'European AQI (EEA)',
    authorityLabel: 'European Environment Agency (EEA) 0–100+ Index',
    methodologyNote:
      'European AQI reflects the worst hourly concentration band among key pollutants (PM2.5, PM10, NO2, O3, SO2) using EEA thresholds.',
  };

  if (value === null || !Number.isFinite(value) || value < 0) {
    return {
      ...baseMeta,
      value: null,
      status: 'unavailable',
      category: 'Unavailable',
      pollutionLevel: 'unavailable',
      pollutionLevelLabel: 'Unavailable',
      severityToken: 'unavailable',
      meaning:
        'Current European AQI data could not be interpreted reliably from the provider response.',
      precautionSummary:
        'Follow general low-emission routines and verify air quality updates before prolonged outdoor exercise.',
    };
  }

  const rounded = Math.round(value);
  if (rounded <= 20) {
    return {
      ...baseMeta,
      value: rounded,
      status: 'available',
      category: 'Good',
      pollutionLevel: 'low',
      pollutionLevelLabel: 'Low pollution level',
      severityToken: 'good',
      meaning: 'Concentrations fall within the lowest EEA band with clean background dispersion.',
      precautionSummary:
        'Routine outdoor commuting and natural cross-ventilation are well supported.',
    };
  }
  if (rounded <= 40) {
    return {
      ...baseMeta,
      value: rounded,
      status: 'available',
      category: 'Fair',
      pollutionLevel: 'low',
      pollutionLevelLabel: 'Low–fair pollution level',
      severityToken: 'good',
      meaning: 'Air quality remains fair across tracked European index thresholds.',
      precautionSummary:
        'Normal outdoor activity is appropriate; maintain clean indoor ventilation.',
    };
  }
  if (rounded <= 60) {
    return {
      ...baseMeta,
      value: rounded,
      status: 'available',
      category: 'Moderate',
      pollutionLevel: 'moderate',
      pollutionLevelLabel: 'Moderate pollution level',
      severityToken: 'moderate',
      meaning:
        'Moderate urban pollutant accumulation may be noticeable near arterial roads or valley heating corridors.',
      precautionSummary:
        'Prefer quieter low-traffic routes for walking or cycling and ventilate rooms outside rush hour.',
    };
  }
  if (rounded <= 80) {
    return {
      ...baseMeta,
      value: rounded,
      status: 'available',
      category: 'Poor',
      pollutionLevel: 'high',
      pollutionLevelLabel: 'High pollution level',
      severityToken: 'high',
      meaning:
        'Elevated particulate or nitrogen dioxide levels indicate poor dispersion and higher exposure.',
      precautionSummary:
        'Limit prolonged outdoor exertion, ventilate briefly only when outdoor levels dip, and activate indoor HEPA filtration.',
    };
  }
  if (rounded <= 100) {
    return {
      ...baseMeta,
      value: rounded,
      status: 'available',
      category: 'Very poor',
      pollutionLevel: 'very_high',
      pollutionLevelLabel: 'Very high pollution level',
      severityToken: 'very_high',
      meaning:
        'Heavy pollutant concentration requires active indoor protection and reduced travel.',
      precautionSummary:
        'Keep windows closed during smog peaks, shift errands or exercise indoors, and avoid solid-fuel heating.',
    };
  }

  return {
    ...baseMeta,
    value: rounded,
    status: 'available',
    category: 'Extremely poor',
    pollutionLevel: 'very_high',
    pollutionLevelLabel: 'Severe pollution level',
    severityToken: 'very_high',
    meaning: 'Concentrations exceed the highest EEA threshold across one or more pollutants.',
    precautionSummary:
      'Remain indoors with filtered air recirculation and defer non-essential outdoor exposure.',
  };
}

export function identifyDominantPollutant(
  current: NormalizedCurrentReading,
): DominantPollutantSummary {
  const candidates: Array<{
    code: PollutantCode;
    subIndex: number;
    basis: 'provider_sub_index' | 'epa_breakpoint_estimate';
  }> = [];

  const codes: readonly PollutantCode[] = ['pm2_5', 'pm10', 'no2', 'so2', 'co', 'o3'];

  for (const code of codes) {
    const providerSub = current.usAqiSubIndices[code];
    if (typeof providerSub === 'number' && Number.isFinite(providerSub) && providerSub >= 0) {
      candidates.push({ code, subIndex: Math.round(providerSub), basis: 'provider_sub_index' });
      continue;
    }
    const computed = computeEpaPollutantSubIndex(code, current.pollutants[code]);
    if (computed !== null) {
      candidates.push({ code, subIndex: computed, basis: 'epa_breakpoint_estimate' });
    }
  }

  if (candidates.length === 0) {
    return {
      status: 'unavailable',
      code: null,
      abbreviation: null,
      fullName: null,
      basis: 'unavailable',
      estimatedSubIndex: null,
      explanation:
        'Insufficient valid pollutant readings are present to determine which pollutant is driving current air quality.',
    };
  }

  candidates.sort((a, b) => b.subIndex - a.subIndex);
  const top = candidates[0];
  if (!top) {
    return {
      status: 'unavailable',
      code: null,
      abbreviation: null,
      fullName: null,
      basis: 'unavailable',
      estimatedSubIndex: null,
      explanation:
        'Insufficient valid pollutant readings are present to determine which pollutant is driving current air quality.',
    };
  }

  const metadata = POLLUTANT_CATALOG[top.code];
  const rawValue = current.pollutants[top.code];
  const unit = current.units[top.code];
  const valueSnippet = rawValue !== null ? ` (${rawValue} ${unit})` : '';

  return {
    status: 'available',
    code: top.code,
    abbreviation: metadata.abbreviation,
    fullName: metadata.fullName,
    basis: top.basis,
    estimatedSubIndex: top.subIndex,
    explanation: `${metadata.fullName} (${metadata.abbreviation})${valueSnippet} shows the highest pollutant-specific index contribution (${top.subIndex} on US EPA sub-index scaling) among currently available readings.`,
  };
}
