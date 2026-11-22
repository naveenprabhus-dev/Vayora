import type { PollutantCode, PollutantDetail } from '@uaqa/contracts';
import { POLLUTANT_CATALOG } from '../air-quality.constants.ts';
import type { NormalizedCurrentReading } from '../air-quality.types.ts';

const ORDERED_POLLUTANTS: readonly PollutantCode[] = ['pm2_5', 'pm10', 'no2', 'so2', 'co', 'o3'];

function classifyConcentrationBand(
  code: PollutantCode,
  concentration: number | null,
): {
  band: PollutantDetail['concentrationBand'];
  label: string;
} {
  if (concentration === null || !Number.isFinite(concentration) || concentration < 0) {
    return { band: 'unavailable', label: 'Unavailable' };
  }

  const thresholds = POLLUTANT_CATALOG[code].thresholdsUgPerM3;
  if (concentration <= thresholds.lowMax) {
    return { band: 'low', label: 'Low concentration' };
  }
  if (concentration <= thresholds.moderateMax) {
    return { band: 'moderate', label: 'Moderate concentration' };
  }
  if (concentration <= thresholds.elevatedMax) {
    return { band: 'elevated', label: 'Elevated concentration' };
  }
  return { band: 'high', label: 'High concentration' };
}

export function interpretPollutants(current: NormalizedCurrentReading): readonly PollutantDetail[] {
  return ORDERED_POLLUTANTS.map((code) => {
    const metadata = POLLUTANT_CATALOG[code];
    const concentration = current.pollutants[code];
    const unit = current.units[code] || metadata.defaultUnit;
    const { band, label } = classifyConcentrationBand(code, concentration);

    return {
      code,
      fullName: metadata.fullName,
      abbreviation: metadata.abbreviation,
      concentration,
      unit,
      status: concentration !== null ? 'available' : 'unavailable',
      concentrationBand: band,
      concentrationBandLabel: label,
      explanation: metadata.explanation,
      distinctionNote:
        'Measured concentration in mass per cubic meter; evaluated separately from composite AQI index scales.',
    };
  });
}
