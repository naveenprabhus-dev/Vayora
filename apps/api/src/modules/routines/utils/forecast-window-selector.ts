import type {
  BetterTimeWindowsSummary,
  DataTransparencyInfo,
  ForecastWindowSuggestion,
  HourlyForecastPoint,
  RoutineTimePeriod,
} from '@uaqa/contracts';

function resolveLocalHour(timestamp: string, timezone: string): number | null {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: timezone && timezone.trim().length > 0 ? timezone : 'UTC',
    }).format(parsed);
    const hourNum = Number(formatted);
    return Number.isInteger(hourNum) ? hourNum % 24 : null;
  } catch {
    return parsed.getUTCHours();
  }
}

function mapHourToPeriod(hour: number): RoutineTimePeriod {
  if (hour >= 6 && hour <= 11) {
    return 'morning';
  }
  if (hour >= 12 && hour <= 16) {
    return 'midday';
  }
  if (hour >= 17 && hour <= 21) {
    return 'evening';
  }
  return 'night';
}

function formatHourRange(startIso: string, endIso: string, timezone: string): string {
  const formatSingle = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    try {
      return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone && timezone.trim().length > 0 ? timezone : 'UTC',
      }).format(date);
    } catch {
      return date.toISOString().slice(11, 16);
    }
  };
  return `${formatSingle(startIso)} – ${formatSingle(endIso)}`;
}

function scoreForecastSlot(slot: HourlyForecastPoint): number | null {
  if (slot.usAqi !== null) {
    // Slightly penalize elevated NO2 or O3 when comparable AQI ties occur
    const no2Penalty = slot.no2 !== null && slot.no2 > 90 ? 5 : 0;
    const o3Penalty = slot.o3 !== null && slot.o3 > 100 ? 5 : 0;
    return slot.usAqi + no2Penalty + o3Penalty;
  }
  if (slot.europeanAqi !== null) {
    return slot.europeanAqi * 1.5;
  }
  return null;
}

export function selectBetterTimeWindows(options: {
  readonly hourly: readonly HourlyForecastPoint[];
  readonly timezone: string;
  readonly transparency: DataTransparencyInfo;
}): BetterTimeWindowsSummary {
  const { hourly, timezone, transparency } = options;

  if (transparency.freshnessStatus === 'unavailable' || hourly.length === 0) {
    return {
      status: 'unavailable',
      windows: [],
      limitationDisclosure:
        'Hourly forecast data is currently unavailable from the upstream provider, so comparative better time windows cannot be determined or fabricated.',
    };
  }

  const validSlots = hourly
    .map((slot) => {
      const score = scoreForecastSlot(slot);
      const localHour = resolveLocalHour(slot.timestamp, timezone);
      return score !== null && localHour !== null ? { slot, score, localHour } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (validSlots.length < 2) {
    return {
      status: 'unavailable',
      windows: [],
      limitationDisclosure:
        'Too few valid hourly forecast points are available to compare outdoor time windows reliably.',
    };
  }

  // Evaluate 2-hour contiguous daytime/early-evening windows (06:00–21:00 local) first,
  // then fall back to all valid 2-hour windows if needed.
  const candidates: Array<{
    readonly start: HourlyForecastPoint;
    readonly end: HourlyForecastPoint;
    readonly avgScore: number;
    readonly period: RoutineTimePeriod;
    readonly usValues: number[];
    readonly euValues: number[];
    readonly maxO3: number;
    readonly maxPm25: number;
  }> = [];

  for (let i = 0; i < validSlots.length - 1; i += 1) {
    const first = validSlots[i];
    const second = validSlots[i + 1];
    if (!first || !second) {
      continue;
    }
    const avgScore = (first.score + second.score) / 2;
    const usValues = [first.slot.usAqi, second.slot.usAqi].filter((v): v is number => v !== null);
    const euValues = [first.slot.europeanAqi, second.slot.europeanAqi].filter(
      (v): v is number => v !== null,
    );
    const maxO3 = Math.max(first.slot.o3 ?? 0, second.slot.o3 ?? 0);
    const maxPm25 = Math.max(first.slot.pm25 ?? 0, second.slot.pm25 ?? 0);

    candidates.push({
      start: first.slot,
      end: second.slot,
      avgScore,
      period: mapHourToPeriod(first.localHour),
      usValues,
      euValues,
      maxO3,
      maxPm25,
    });
  }

  if (candidates.length === 0) {
    return {
      status: 'unavailable',
      windows: [],
      limitationDisclosure:
        'Insufficient contiguous forecast slots were available to identify time windows.',
    };
  }

  const daytimeCandidates = candidates.filter((c) => c.period !== 'night');
  const pool = daytimeCandidates.length > 0 ? [...daytimeCandidates] : [...candidates];
  pool.sort((a, b) => a.avgScore - b.avgScore);

  const selected: typeof pool = [];
  for (const candidate of pool) {
    const alreadyHasPeriod = selected.some((existing) => existing.period === candidate.period);
    if (!alreadyHasPeriod) {
      selected.push(candidate);
    }
    if (selected.length >= 2) {
      break;
    }
  }

  const allScores = validSlots.map((item) => item.score);
  const peakScore = Math.max(...allScores);
  const isStale = transparency.freshnessStatus === 'stale';
  const dataBasis: ForecastWindowSuggestion['dataBasis'] = isStale
    ? 'stale_model_forecast'
    : 'model_forecast';

  const windows: ForecastWindowSuggestion[] = selected.map((win, index) => {
    const usMin = win.usValues.length > 0 ? Math.min(...win.usValues) : null;
    const usMax = win.usValues.length > 0 ? Math.max(...win.usValues) : null;
    const euMin = win.euValues.length > 0 ? Math.min(...win.euValues) : null;
    const euMax = win.euValues.length > 0 ? Math.max(...win.euValues) : null;
    const hasSignificantSpread = peakScore - win.avgScore >= 8;
    const label = `${formatHourRange(win.start.timestamp, win.end.timestamp, timezone)} (${win.period})`;

    const rationale = hasSignificantSpread
      ? `Model forecast shows comparatively lower index readings during this ${win.period} interval than the 24-hour peak.`
      : `Readings vary little across the forecast horizon; this ${win.period} slot sits near the lowest forecasted range.`;

    const cautionParts: string[] = [];
    if (usMax !== null && usMax > 100) {
      cautionParts.push(
        'Even the lowest forecast window stays above US AQI 100; keep strenuous outdoor activity brief.',
      );
    }
    if (win.maxO3 > 100) {
      cautionParts.push(
        'Ground-level ozone (O3) rises in this window; prefer lower-exertion pacing.',
      );
    }
    if (win.maxPm25 > 35.4) {
      cautionParts.push('Fine particulates (PM2.5) remain elevated; avoid busy road corridors.');
    }
    if (cautionParts.length === 0) {
      cautionParts.push(
        'Model-derived hourly trends cannot capture localized traffic idling or wood-smoke plumes.',
      );
    }

    return {
      id: `forecast-window-${index + 1}-${win.period}`,
      period: win.period,
      startTimestamp: win.start.timestamp,
      endTimestamp: win.end.timestamp,
      label,
      usAqiMin: usMin,
      usAqiMax: usMax,
      europeanAqiMin: euMin,
      europeanAqiMax: euMax,
      dataBasis,
      rationale,
      cautionNote: cautionParts.join(' '),
    };
  });

  return {
    status: isStale ? 'stale' : 'available',
    windows,
    limitationDisclosure: isStale
      ? 'Displayed windows come from stale cached Open-Meteo model forecasts and may not match sudden wind or inversion shifts.'
      : 'Windows are derived from Open-Meteo hourly atmospheric model forecasts (regional resolution) and are not direct street-level monitor measurements.',
  };
}
