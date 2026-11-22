import type { PollutantCode } from '@uaqa/contracts';

export const OPEN_METEO_PROVIDER_ID = 'open-meteo' as const;
export const OPEN_METEO_PROVIDER_NAME = 'Open-Meteo Air Quality Model (CAMS / Global)';
export const OPEN_METEO_ATTRIBUTION =
  'Air quality forecast and atmospheric dispersion data provided by Open-Meteo (CC BY 4.0).';

export const OPEN_METEO_CURRENT_VARIABLES = [
  'us_aqi',
  'european_aqi',
  'pm2_5',
  'pm10',
  'nitrogen_dioxide',
  'sulphur_dioxide',
  'carbon_monoxide',
  'ozone',
  'us_aqi_pm2_5',
  'us_aqi_pm10',
  'us_aqi_nitrogen_dioxide',
  'us_aqi_sulphur_dioxide',
  'us_aqi_carbon_monoxide',
  'us_aqi_ozone',
] as const;

export const OPEN_METEO_HOURLY_VARIABLES = [
  'us_aqi',
  'european_aqi',
  'pm2_5',
  'pm10',
  'nitrogen_dioxide',
  'sulphur_dioxide',
  'carbon_monoxide',
  'ozone',
] as const;

export const AIR_QUALITY_LIMITS = {
  maxUpstreamPayloadBytes: 512 * 1024, // 512 KB cap on external JSON payloads
  maxForecastDays: 2,
  defaultForecastHours: 24,
  maxForecastHours: 48,
  maxRetriesOnTransientFailure: 1,
  retryBaseDelayMs: 150,
  coordinateCachePrecisionDigits: 3,
} as const;

/**
 * Official US EPA AQI pollutant-specific breakpoints (40 CFR Part 58 Appendix G,
 * updated with the May 2024 PM2.5 standard).
 * Units match Open-Meteo converted benchmarks:
 * - PM2.5, PM10: µg/m³
 * - NO2, SO2, O3: ppb (converted from µg/m³ at 25°C, 1 atm)
 * - CO: ppm (converted from µg/m³ at 25°C, 1 atm)
 */
export interface BreakpointRange {
  readonly cLow: number;
  readonly cHigh: number;
  readonly iLow: number;
  readonly iHigh: number;
}

export const EPA_PM25_BREAKPOINTS: readonly BreakpointRange[] = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 500 },
];

export const EPA_PM10_BREAKPOINTS: readonly BreakpointRange[] = [
  { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
  { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
  { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
  { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
  { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
  { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
];

export const EPA_O3_8HR_PPB_BREAKPOINTS: readonly BreakpointRange[] = [
  { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
  { cLow: 55, cHigh: 70, iLow: 51, iHigh: 100 },
  { cLow: 71, cHigh: 85, iLow: 101, iHigh: 150 },
  { cLow: 86, cHigh: 105, iLow: 151, iHigh: 200 },
  { cLow: 106, cHigh: 200, iLow: 201, iHigh: 300 },
];

export const EPA_NO2_1HR_PPB_BREAKPOINTS: readonly BreakpointRange[] = [
  { cLow: 0, cHigh: 53, iLow: 0, iHigh: 50 },
  { cLow: 54, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 101, cHigh: 360, iLow: 101, iHigh: 150 },
  { cLow: 361, cHigh: 649, iLow: 151, iHigh: 200 },
  { cLow: 650, cHigh: 1249, iLow: 201, iHigh: 300 },
  { cLow: 1250, cHigh: 2049, iLow: 301, iHigh: 500 },
];

export const EPA_SO2_1HR_PPB_BREAKPOINTS: readonly BreakpointRange[] = [
  { cLow: 0, cHigh: 35, iLow: 0, iHigh: 50 },
  { cLow: 36, cHigh: 75, iLow: 51, iHigh: 100 },
  { cLow: 76, cHigh: 185, iLow: 101, iHigh: 150 },
  { cLow: 186, cHigh: 304, iLow: 151, iHigh: 200 },
  { cLow: 305, cHigh: 604, iLow: 201, iHigh: 300 },
  { cLow: 605, cHigh: 1004, iLow: 301, iHigh: 500 },
];

export const EPA_CO_8HR_PPM_BREAKPOINTS: readonly BreakpointRange[] = [
  { cLow: 0.0, cHigh: 4.4, iLow: 0, iHigh: 50 },
  { cLow: 4.5, cHigh: 9.4, iLow: 51, iHigh: 100 },
  { cLow: 9.5, cHigh: 12.4, iLow: 101, iHigh: 150 },
  { cLow: 12.5, cHigh: 15.4, iLow: 151, iHigh: 200 },
  { cLow: 15.5, cHigh: 30.4, iLow: 201, iHigh: 300 },
  { cLow: 30.5, cHigh: 50.4, iLow: 301, iHigh: 500 },
];

/** Standard 25°C, 1 atm conversion factors from µg/m³ to ppb / ppm */
export const GAS_CONVERSION_FACTORS = {
  no2UgPerM3PerPpb: 1.88,
  so2UgPerM3PerPpb: 2.62,
  o3UgPerM3PerPpb: 1.96,
  coUgPerM3PerPpm: 1145,
} as const;

export interface PollutantCatalogMetadata {
  readonly code: PollutantCode;
  readonly fullName: string;
  readonly abbreviation: string;
  readonly defaultUnit: string;
  readonly thresholdsUgPerM3: {
    readonly lowMax: number;
    readonly moderateMax: number;
    readonly elevatedMax: number;
  };
  readonly explanation: string;
}

export const POLLUTANT_CATALOG: Readonly<Record<PollutantCode, PollutantCatalogMetadata>> = {
  pm2_5: {
    code: 'pm2_5',
    fullName: 'Fine Particulate Matter',
    abbreviation: 'PM2.5',
    defaultUnit: 'µg/m³',
    thresholdsUgPerM3: { lowMax: 12, moderateMax: 35.4, elevatedMax: 55.4 },
    explanation:
      'Airborne particles 2.5 micrometers or smaller, commonly elevated during winter solid-fuel heating, traffic, and stagnant atmospheric inversions.',
  },
  pm10: {
    code: 'pm10',
    fullName: 'Coarse Particulate Matter',
    abbreviation: 'PM10',
    defaultUnit: 'µg/m³',
    thresholdsUgPerM3: { lowMax: 45, moderateMax: 100, elevatedMax: 180 },
    explanation:
      'Inhalable particles up to 10 micrometers from road dust, construction, combustion ash, and winter anti-skid grit resuspension.',
  },
  no2: {
    code: 'no2',
    fullName: 'Nitrogen Dioxide',
    abbreviation: 'NO2',
    defaultUnit: 'µg/m³',
    thresholdsUgPerM3: { lowMax: 25, moderateMax: 75, elevatedMax: 150 },
    explanation:
      'A combustion-related gas formed primarily near road traffic corridors, diesel engines, and fuel-burning heating equipment.',
  },
  so2: {
    code: 'so2',
    fullName: 'Sulphur Dioxide',
    abbreviation: 'SO2',
    defaultUnit: 'µg/m³',
    thresholdsUgPerM3: { lowMax: 20, moderateMax: 40, elevatedMax: 125 },
    explanation:
      'A sulfur-containing gas emitted by coal, heavy oil, solid-fuel heating stoves, and industrial fuel combustion.',
  },
  co: {
    code: 'co',
    fullName: 'Carbon Monoxide',
    abbreviation: 'CO',
    defaultUnit: 'µg/m³',
    thresholdsUgPerM3: { lowMax: 4000, moderateMax: 9000, elevatedMax: 14000 },
    explanation:
      'A colorless gas produced by incomplete fuel combustion in vehicles, generators, fireplaces, and poorly vented heaters.',
  },
  o3: {
    code: 'o3',
    fullName: 'Ozone',
    abbreviation: 'O3',
    defaultUnit: 'µg/m³',
    thresholdsUgPerM3: { lowMax: 60, moderateMax: 100, elevatedMax: 160 },
    explanation:
      'Ground-level secondary oxidant formed when nitrogen oxides and organic compounds react in sunlight; typically lower in dark winter inversions than sunny afternoons.',
  },
} as const;
