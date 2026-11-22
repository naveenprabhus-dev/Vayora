import type { HouseholdLifestyleInput } from '@uaqa/contracts';
import type { SelectOption } from '../../components/index.ts';

export const LOCATION_ZONE_OPTIONS: readonly SelectOption[] = [
  { value: 'urban_core', label: 'Dense urban core / high-traffic corridor' },
  { value: 'suburban_residential', label: 'Suburban or outer residential neighborhood' },
  { value: 'industrial_adjacent', label: 'Mixed residential & industrial corridor' },
  { value: 'valley_basin', label: 'Valley or topographic smog-trapping basin' },
];

export const HOUSEHOLD_COMPOSITION_OPTIONS = [
  {
    value: 'adults',
    label: 'Adults (18–64)',
    description: 'General daily commuting and indoor routine planning',
  },
  {
    value: 'young_children',
    label: 'Young children (under 5)',
    description: 'Stroller travel timing and indoor play air-quality routines',
  },
  {
    value: 'school_age_children',
    label: 'School-age children (5–17)',
    description: 'School drop-off modes and afternoon outdoor activity windows',
  },
  {
    value: 'older_adults',
    label: 'Older adults (65+)',
    description: 'Low-exertion errand timing during severe winter smog days',
  },
  {
    value: 'pets',
    label: 'Household pets',
    description: 'Shortened walk scheduling during inversion alerts',
  },
] as const;

export const COMMUTE_MODE_OPTIONS: readonly SelectOption[] = [
  { value: 'public_transit', label: 'Public transit (bus, tram, rail)' },
  { value: 'walking', label: 'Walking' },
  { value: 'cycling', label: 'Cycling / e-bike' },
  { value: 'ev', label: 'Electric vehicle' },
  { value: 'carpool', label: 'Shared carpool' },
  { value: 'gas_vehicle', label: 'Gasoline or diesel vehicle' },
];

export const OUTDOOR_PATTERN_OPTIONS: readonly SelectOption[] = [
  { value: 'mostly_indoors', label: 'Mostly indoors during winter months' },
  { value: 'morning_commute', label: 'Peak morning & evening commute exposure' },
  { value: 'school_run_family', label: 'Daily school run & neighborhood errands' },
  { value: 'evening_exercise', label: 'Regular outdoor walking or exercise' },
  { value: 'extended_outdoor', label: 'Extended daily outdoor work or caregiving' },
];

export const VENTILATION_OPTIONS: readonly SelectOption[] = [
  { value: 'natural_windows', label: 'Natural window ventilation only' },
  { value: 'mechanical_hvac', label: 'Standard mechanical ventilation / HVAC' },
  { value: 'filtered_hvac_merv13', label: 'Filtered HVAC (MERV-13 or higher)' },
  { value: 'portable_hepa_only', label: 'Portable room air purifiers with closed windows' },
];

export const HEATING_OPTIONS: readonly SelectOption[] = [
  { value: 'heat_pump', label: 'Electric heat pump' },
  { value: 'electric', label: 'Electric baseboard or radiant heating' },
  { value: 'district', label: 'District / municipal heating' },
  { value: 'natural_gas', label: 'Natural gas boiler or furnace' },
  { value: 'solid_fuel', label: 'Wood, coal, or pellet stove' },
];

export const GUIDANCE_FOCUS_OPTIONS: readonly SelectOption[] = [
  { value: 'balanced', label: 'Balanced household routines, indoor air & commute tips' },
  { value: 'indoor_air', label: 'Prioritize indoor filtration, ventilation & low-smoke cooking' },
  { value: 'commute_exposure', label: 'Prioritize low-emission & lower-exposure commute shifts' },
  { value: 'low_emission_habits', label: 'Prioritize community emission-reduction alternatives' },
];

export const REMINDER_CADENCE_OPTIONS: readonly SelectOption[] = [
  { value: 'daily_smog_alerts', label: 'Daily winter smog check-ins' },
  { value: 'high_aqi_only', label: 'Only during elevated pollution episodes' },
  { value: 'weekly_summary', label: 'Weekly household habit summary' },
];

export function createInitialHouseholdDraft(
  existing?: HouseholdLifestyleInput | null,
): HouseholdLifestyleInput {
  if (existing) {
    return {
      ...existing,
      locationPreferences: { ...existing.locationPreferences },
      householdComposition: [...existing.householdComposition],
      lifestylePreferences: { ...existing.lifestylePreferences },
    };
  }

  return {
    country: '',
    city: '',
    neighborhood: '',
    postalPrefix: '',
    locationPreferences: {
      primaryZoneType: 'urban_core',
      alertsEnabled: true,
    },
    householdSize: 2,
    householdComposition: ['adults'],
    primaryCommuteMode: 'public_transit',
    outdoorActivityPattern: 'morning_commute',
    ventilationContext: 'natural_windows',
    hasIndoorAirPurifier: false,
    heatingType: 'district',
    lifestylePreferences: {
      preferredGuidanceFocus: 'balanced',
      reminderCadence: 'daily_smog_alerts',
    },
    onboardingCompleted: false,
  };
}

export function findOptionLabel(options: readonly SelectOption[], value: string): string {
  return options.find((opt) => opt.value === value)?.label ?? value;
}
