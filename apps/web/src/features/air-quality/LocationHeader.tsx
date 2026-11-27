import {
  locationUpdateSchema,
  type AirQualityLocationSummary,
  type DataTransparencyInfo,
  type LocationUpdateInput,
} from '@uaqa/contracts';
import { MapPin, RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AlertBanner, Button, FormField, SurfaceCard } from '../../components/index.ts';
import { formatSafeUserError } from '../../lib/errorMessages.ts';
import { formatIsoTimestamp } from './severityStyles.ts';

export interface LocationHeaderProps {
  readonly location: AirQualityLocationSummary;
  readonly transparency: DataTransparencyInfo;
  readonly isRefreshing: boolean;
  readonly isUpdatingLocation: boolean;
  readonly onRefresh: () => void;
  readonly onUpdateLocation: (input: LocationUpdateInput) => Promise<void>;
}

const FRESHNESS_LABEL: Readonly<Record<DataTransparencyInfo['freshnessStatus'], string>> = {
  fresh: 'Fresh model telemetry',
  stale: 'Stale cached telemetry',
  unavailable: 'Telemetry unavailable',
};

export function LocationHeader({
  location,
  transparency,
  isRefreshing,
  isUpdatingLocation,
  onRefresh,
  onUpdateLocation,
}: LocationHeaderProps) {
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [country, setCountry] = useState(location.country);
  const [city, setCity] = useState(location.city);
  const [neighborhood, setNeighborhood] = useState(location.neighborhood);
  const [postalPrefix, setPostalPrefix] = useState(location.postalPrefix);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function openLocationEditor() {
    setCountry(location.country);
    setCity(location.city);
    setNeighborhood(location.neighborhood);
    setPostalPrefix(location.postalPrefix);
    setFieldErrors({});
    setSubmitError(null);
    setIsEditingLocation(true);
  }

  async function handleLocationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = locationUpdateSchema.safeParse({
      country,
      city,
      neighborhood,
      postalPrefix,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'city');
        if (!nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    try {
      await onUpdateLocation(parsed.data);
      setIsEditingLocation(false);
    } catch (error) {
      setSubmitError(
        formatSafeUserError(error, 'Unable to resolve or save this household location.'),
      );
    }
  }

  return (
    <SurfaceCard as="section" aria-labelledby="air-quality-location-heading">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-xs font-medium tracking-wider text-[#0F5132] uppercase">
            VAYORA · Air Quality Intelligence
          </p>
          <h2
            id="air-quality-location-heading"
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight text-slate-950 focus:outline-none"
          >
            {location.neighborhood}, {location.city}, {location.country}
          </h2>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#0F5132]" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {location.latitude.toFixed(3)}°, {location.longitude.toFixed(3)}°
              </span>
              <span className="text-slate-500">({location.timezone})</span>
            </span>
            <span>
              Status:{' '}
              <strong className="font-semibold text-slate-950">
                {FRESHNESS_LABEL[transparency.freshnessStatus]}
              </strong>
            </span>
            <span>
              Observed:{' '}
              <time
                dateTime={transparency.observationTimestamp ?? undefined}
                className="font-mono tabular-nums text-slate-900"
              >
                {formatIsoTimestamp(transparency.observationTimestamp, location.timezone)}
              </time>
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            Source: {transparency.providerName} · {transparency.dataNatureDisclosure}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" isLoading={isRefreshing} onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isRefreshing ? 'Refreshing...' : 'Refresh telemetry'}
          </Button>
          <Button
            type="button"
            variant={isEditingLocation ? 'secondary' : 'primary'}
            aria-expanded={isEditingLocation}
            onClick={() => {
              if (isEditingLocation) {
                setIsEditingLocation(false);
              } else {
                openLocationEditor();
              }
            }}
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {isEditingLocation ? 'Close location form' : 'Change location'}
          </Button>
        </div>
      </div>

      {isEditingLocation ? (
        <form
          onSubmit={handleLocationSubmit}
          noValidate
          className="mt-6 space-y-4 border-t border-slate-200 pt-5"
          aria-label="Update saved air quality location"
        >
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              Update Household Monitoring Location
            </h3>
            <p className="text-xs text-slate-600">
              Enter your city, neighborhood, country, and postal prefix. Coordinates are resolved
              server-side without automatic GPS tracking.
            </p>
          </div>

          {submitError ? (
            <AlertBanner tone="error" title="Location update failed">
              <p>{submitError}</p>
            </AlertBanner>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              id="aq-location-country"
              label="Country"
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              error={fieldErrors.country}
              placeholder="Poland"
            />
            <FormField
              id="aq-location-city"
              label="City"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              error={fieldErrors.city}
              placeholder="Krakow"
            />
            <FormField
              id="aq-location-neighborhood"
              label="Neighborhood or district"
              required
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              error={fieldErrors.neighborhood}
              placeholder="Krowodrza"
            />
            <FormField
              id="aq-location-postal"
              label="Postal prefix"
              required
              value={postalPrefix}
              onChange={(e) => setPostalPrefix(e.target.value)}
              error={fieldErrors.postalPrefix}
              placeholder="30-01"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditingLocation(false)}
              disabled={isUpdatingLocation}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isUpdatingLocation}>
              {isUpdatingLocation ? 'Saving location...' : 'Save location'}
            </Button>
          </div>
        </form>
      ) : null}
    </SurfaceCard>
  );
}
