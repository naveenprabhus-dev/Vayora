import type { IndoorScenarioOption } from '@uaqa/contracts';

export const INDOOR_CACHE_TTL_MS = 5 * 60 * 1000;

export const MANDATORY_NO_SENSOR_DISCLOSURE =
  'Indoor air quality is not being measured. These recommendations are based on your household settings, available outdoor air-quality information and general guidance.';

export const INDOOR_SCENARIO_OPTIONS: readonly IndoorScenarioOption[] = [
  {
    id: 'baseline',
    label: 'Saved household baseline',
    shortDescription:
      'Tailored to your saved ventilation, purifier, heating, and outdoor conditions.',
  },
  {
    id: 'cooking',
    label: 'Cooking at home',
    shortDescription:
      'Simulates active stovetop or oven cooking emissions and exhaust precautions.',
  },
  {
    id: 'cleaning',
    label: 'Cleaning the house',
    shortDescription: 'Simulates surface sprays, detergents, dust resuspension, and safe airing.',
  },
  {
    id: 'opening_windows',
    label: 'Opening windows',
    shortDescription: 'Simulates natural window ventilation relative to outdoor air quality.',
  },
  {
    id: 'operating_purifier',
    label: 'Operating an air purifier',
    shortDescription: 'Simulates running a portable HEPA filter unit for indoor particles.',
  },
  {
    id: 'elevated_outdoor_pollution',
    label: 'Elevated outdoor pollution',
    shortDescription: 'Simulates a high outdoor winter-smog episode to inspect protective steps.',
  },
] as const;

export const INDOOR_NON_MEDICAL_NOTICE =
  'General educational and environmental guidance only. VAYORA does not provide medical diagnoses, clinical risk scores, or individualized medical treatment. Always follow manufacturer instructions and local building safety codes for combustion appliances, gas detectors, and ventilation.';
