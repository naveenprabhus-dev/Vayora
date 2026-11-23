import type { RoutineImpactType, RoutineTimePeriod } from '@uaqa/contracts';

export const ROUTINE_PERIOD_METADATA: Readonly<
  Record<
    RoutineTimePeriod,
    {
      readonly label: string;
      readonly windowHint: string;
      readonly startHour: number;
      readonly endHour: number;
    }
  >
> = {
  morning: {
    label: 'Morning',
    windowHint: '06:00 – 11:00 local time',
    startHour: 6,
    endHour: 11,
  },
  midday: {
    label: 'Midday',
    windowHint: '12:00 – 16:00 local time',
    startHour: 12,
    endHour: 16,
  },
  evening: {
    label: 'Evening',
    windowHint: '17:00 – 21:00 local time',
    startHour: 17,
    endHour: 21,
  },
  night: {
    label: 'Night',
    windowHint: '22:00 – 05:00 local time',
    startHour: 22,
    endHour: 5,
  },
};

export const IMPACT_LABELS: Readonly<Record<RoutineImpactType, string>> = {
  exposure_reduction: 'Reduces personal exposure',
  emission_reduction: 'Reduces local emissions',
  both: 'Reduces exposure & emissions',
};

export const COMMUTE_MODE_LABELS: Readonly<Record<string, string>> = {
  walking: 'Walking',
  cycling: 'Cycling / e-bike',
  public_transit: 'Public transit',
  ev: 'Electric vehicle',
  carpool: 'Shared carpool',
  gas_vehicle: 'Gasoline or diesel vehicle',
};

export const ROUTINES_CACHE_TTL_MS = 10 * 60 * 1000;
