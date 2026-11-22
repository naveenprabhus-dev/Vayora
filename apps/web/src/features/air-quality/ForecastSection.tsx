import type { DataTransparencyInfo, HourlyForecastPoint } from '@uaqa/contracts';
import { BarChart3, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SurfaceCard } from '../../components/index.ts';

type ForecastMetricId = 'usAqi' | 'europeanAqi' | 'pm25' | 'pm10';

interface MetricDefinition {
  readonly id: ForecastMetricId;
  readonly label: string;
  readonly unit: string;
}

const FORECAST_METRICS: readonly MetricDefinition[] = [
  { id: 'usAqi', label: 'US AQI', unit: 'US AQI' },
  { id: 'europeanAqi', label: 'European AQI', unit: 'EAQI' },
  { id: 'pm25', label: 'PM2.5', unit: 'µg/m³' },
  { id: 'pm10', label: 'PM10', unit: 'µg/m³' },
];

export interface ForecastSectionProps {
  readonly hourly: readonly HourlyForecastPoint[];
  readonly horizonHours: 24 | 48;
  readonly timezone: string;
  readonly transparency: DataTransparencyInfo;
  readonly isLoadingForecast: boolean;
  readonly onChangeHorizon: (hours: 24 | 48) => void;
}

function formatHourLabel(timestamp: string, timezone: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp.slice(11, 16) || timestamp;
  }
  try {
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone || 'UTC',
    }).format(date);
  } catch {
    return timestamp.slice(0, 16).replace('T', ' ');
  }
}

function formatShortHour(timestamp: string, timezone: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp.slice(11, 16) || timestamp;
  }
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone || 'UTC',
    }).format(date);
  } catch {
    return timestamp.slice(11, 16);
  }
}

function formatCellValue(value: number | null, unit?: string): string {
  if (value === null) {
    return 'Unavailable';
  }
  return unit ? `${value} ${unit}` : String(value);
}

export function ForecastSection({
  hourly,
  horizonHours,
  timezone,
  transparency,
  isLoadingForecast,
  onChangeHorizon,
}: ForecastSectionProps) {
  const [selectedMetric, setSelectedMetric] = useState<ForecastMetricId>('usAqi');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const metricMeta: MetricDefinition = FORECAST_METRICS.find(
    (item) => item.id === selectedMetric,
  ) ?? {
    id: 'usAqi',
    label: 'US AQI',
    unit: 'US AQI',
  };

  const chartGeometry = useMemo(() => {
    const width = 760;
    const height = 240;
    const padLeft = 44;
    const padRight = 18;
    const padTop = 20;
    const padBottom = 36;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    const numericValues = hourly
      .map((slot) => slot[selectedMetric])
      .filter((val): val is number => typeof val === 'number' && Number.isFinite(val));

    const maxRaw = numericValues.length > 0 ? Math.max(...numericValues) : 100;
    const yMax = Math.max(20, Math.ceil(maxRaw / 10) * 10);

    const points = hourly.map((slot, index) => {
      const x =
        hourly.length <= 1
          ? padLeft + plotWidth / 2
          : padLeft + (index / (hourly.length - 1)) * plotWidth;
      const val = slot[selectedMetric];
      const y =
        val !== null && Number.isFinite(val)
          ? padTop + plotHeight - (Math.min(val, yMax) / yMax) * plotHeight
          : null;
      return { index, slot, val, x, y };
    });

    // Build discontinuous SVG path segments so null readings leave honest visual gaps
    const segments: string[] = [];
    let currentSegment: string[] = [];
    for (const pt of points) {
      if (pt.y === null) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment.join(' '));
          currentSegment = [];
        }
      } else {
        currentSegment.push(
          `${currentSegment.length === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
        );
      }
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment.join(' '));
    }

    const yTicks = [0, Math.round(yMax / 2), yMax].map((tickVal) => ({
      value: tickVal,
      y: padTop + plotHeight - (tickVal / yMax) * plotHeight,
    }));

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotHeight,
      yMax,
      points,
      segments,
      yTicks,
    };
  }, [hourly, selectedMetric]);

  const safeActiveIndex = hourly.length > 0 ? Math.min(activeIndex, hourly.length - 1) : 0;
  const focusedPoint = hourly[safeActiveIndex] ?? null;
  const hasAnyPoints = hourly.some(
    (slot) =>
      slot.usAqi !== null || slot.europeanAqi !== null || slot.pm25 !== null || slot.pm10 !== null,
  );

  return (
    <SurfaceCard as="section" aria-labelledby="forecast-section-heading">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="forecast-section-heading" className="text-xl font-bold text-slate-950">
            Hourly Air Quality Forecast
          </h2>
          <p className="text-sm text-slate-600">
            Model-generated dispersion trajectory ({horizonHours}-hour horizon ·{' '}
            {transparency.dataNature === 'model_forecast'
              ? 'Open-Meteo atmospheric forecast'
              : 'No live forecast available'}
            ).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <fieldset className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
            <legend className="sr-only">Forecast horizon</legend>
            {([24, 48] as const).map((hours) => (
              <button
                key={hours}
                type="button"
                aria-pressed={horizonHours === hours}
                disabled={isLoadingForecast}
                onClick={() => onChangeHorizon(hours)}
                className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                  horizonHours === hours
                    ? 'bg-[#0F5132] text-white'
                    : 'text-slate-800 hover:bg-white'
                }`}
              >
                {hours}h forecast
              </button>
            ))}
          </fieldset>

          <fieldset className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
            <legend className="sr-only">Forecast display mode</legend>
            <button
              type="button"
              aria-pressed={viewMode === 'chart'}
              onClick={() => setViewMode('chart')}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                viewMode === 'chart' ? 'bg-[#0F5132] text-white' : 'text-slate-800 hover:bg-white'
              }`}
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Trend chart
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'table'}
              onClick={() => setViewMode('table')}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                viewMode === 'table' ? 'bg-[#0F5132] text-white' : 'text-slate-800 hover:bg-white'
              }`}
            >
              <Table2 className="h-4 w-4" aria-hidden="true" />
              Table view
            </button>
          </fieldset>
        </div>
      </div>

      {!hasAnyPoints ? (
        <output className="mt-5 block rounded-lg bg-slate-50 p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Hourly forecast unavailable</p>
          <p className="mt-1">
            No valid hourly forecast data could be retrieved from the provider right now. Missing
            hours are left blank rather than simulated.
          </p>
        </output>
      ) : viewMode === 'chart' ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">Chart metric selector</legend>
              {FORECAST_METRICS.map((metric) => (
                <button
                  key={metric.id}
                  type="button"
                  aria-pressed={selectedMetric === metric.id}
                  onClick={() => setSelectedMetric(metric.id)}
                  className={`min-h-11 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                    selectedMetric === metric.id
                      ? 'border-[#0F5132] bg-emerald-50 text-[#0F5132]'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {metric.label}
                </button>
              ))}
            </fieldset>

            {focusedPoint ? (
              <div
                aria-live="polite"
                className="rounded-lg bg-slate-50 px-3.5 py-2 text-xs text-slate-800"
              >
                <span className="font-semibold text-slate-950">
                  {formatHourLabel(focusedPoint.timestamp, timezone)}:
                </span>{' '}
                <span className="font-mono font-bold tabular-nums text-[#0F5132]">
                  {formatCellValue(focusedPoint[selectedMetric], metricMeta.unit)}
                </span>
                {' · '}
                <span className="font-mono tabular-nums text-slate-700">
                  PM2.5 {formatCellValue(focusedPoint.pm25, 'µg/m³')}
                </span>
              </div>
            ) : null}
          </div>

          <section
            aria-label={`Hourly ${metricMeta.label} trend chart`}
            className="rounded-xl bg-slate-50 p-3 sm:p-4"
          >
            <svg
              viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
              aria-hidden="true"
              className="h-auto w-full"
            >
              {chartGeometry.yTicks.map((tick) => (
                <g key={tick.value}>
                  <line
                    x1={chartGeometry.padLeft}
                    x2={chartGeometry.width - chartGeometry.padRight}
                    y1={tick.y}
                    y2={tick.y}
                    stroke="#CBD5E1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={chartGeometry.padLeft - 8}
                    y={tick.y + 4}
                    textAnchor="end"
                    className="fill-slate-600 font-mono text-[11px]"
                  >
                    {tick.value}
                  </text>
                </g>
              ))}

              {chartGeometry.segments.map((d, idx) => (
                <path
                  key={idx}
                  d={d}
                  fill="none"
                  stroke="#0F5132"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {chartGeometry.points.map((pt) => {
                const showXLabel =
                  pt.index === 0 ||
                  pt.index === hourly.length - 1 ||
                  pt.index % Math.max(4, Math.floor(hourly.length / 6)) === 0;
                const isSelected = pt.index === safeActiveIndex;

                return (
                  <g key={pt.slot.timestamp}>
                    {showXLabel ? (
                      <text
                        x={pt.x}
                        y={chartGeometry.height - 10}
                        textAnchor="middle"
                        className="fill-slate-600 font-mono text-[10px]"
                      >
                        {formatShortHour(pt.slot.timestamp, timezone)}
                      </text>
                    ) : null}

                    {pt.y !== null ? (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 5.5 : 3}
                        fill={isSelected ? '#0F5132' : '#FFFFFF'}
                        stroke="#0F5132"
                        strokeWidth={2}
                        onMouseEnter={() => setActiveIndex(pt.index)}
                        onClick={() => setActiveIndex(pt.index)}
                        className="cursor-pointer"
                      />
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </section>

          {hourly.length > 1 ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
              <label htmlFor="forecast-hour-scrubber" className="font-semibold text-slate-900">
                Inspect hour ({safeActiveIndex + 1} of {hourly.length}):
              </label>
              <input
                id="forecast-hour-scrubber"
                type="range"
                min={0}
                max={hourly.length - 1}
                value={safeActiveIndex}
                onChange={(e) => setActiveIndex(Number(e.target.value))}
                aria-valuetext={
                  focusedPoint
                    ? `${formatHourLabel(focusedPoint.timestamp, timezone)}, ${metricMeta.label}: ${formatCellValue(focusedPoint[selectedMetric], metricMeta.unit)}`
                    : undefined
                }
                className="min-h-11 w-48 accent-[#0F5132] sm:w-64"
              />
            </div>
          ) : null}

          <p className="text-xs text-slate-600">
            Hover any point on the chart or use the hour slider to inspect hourly telemetry, or
            switch to Table view for a complete screen-reader breakdown of every timestamp.
          </p>
        </div>
      ) : (
        <section aria-label="Hourly air quality forecast table" className="mt-5">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <caption className="sr-only">
              Hourly air quality forecast showing US AQI, European AQI, PM2.5, PM10, and NO2
              concentrations
            </caption>
            <thead>
              <tr className="border-b border-slate-300 text-[11px] font-semibold tracking-wider text-slate-700 uppercase sm:text-xs">
                <th scope="col" className="py-3 pr-2 sm:pr-4">
                  Time ({timezone})
                </th>
                <th scope="col" className="px-2 py-3 sm:px-3">
                  US AQI
                </th>
                <th scope="col" className="px-2 py-3 sm:px-3">
                  EAQI
                </th>
                <th scope="col" className="px-2 py-3 sm:px-3">
                  PM2.5
                </th>
                <th scope="col" className="hidden px-3 py-3 sm:table-cell">
                  PM10 (µg/m³)
                </th>
                <th scope="col" className="hidden px-3 py-3 md:table-cell">
                  NO2 (µg/m³)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-xs tabular-nums">
              {hourly.map((slot) => (
                <tr key={slot.timestamp} className="hover:bg-slate-50">
                  <th
                    scope="row"
                    className="py-2.5 pr-2 font-sans font-medium text-slate-900 sm:pr-4"
                  >
                    {formatHourLabel(slot.timestamp, timezone)}
                  </th>
                  <td className="px-2 py-2.5 text-slate-900 sm:px-3">
                    {formatCellValue(slot.usAqi)}
                  </td>
                  <td className="px-2 py-2.5 text-slate-900 sm:px-3">
                    {formatCellValue(slot.europeanAqi)}
                  </td>
                  <td className="px-2 py-2.5 text-slate-900 sm:px-3">
                    {formatCellValue(slot.pm25)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-slate-900 sm:table-cell">
                    {formatCellValue(slot.pm10)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-slate-900 md:table-cell">
                    {formatCellValue(slot.no2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </SurfaceCard>
  );
}
