import type {
  AirQualityCurrentResponse,
  AqiScaleId,
  HouseholdLifestyleRecord,
  HourlyForecastPoint,
  LocationUpdateInput,
} from '@uaqa/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import { formatWorkspaceError } from '../../lib/errorMessages.ts';
import type { HouseholdStore } from '../../lib/householdStore.ts';
import { AqiSummaryCard } from './AqiSummaryCard.tsx';
import { DataTransparencyPanel } from './DataTransparencyPanel.tsx';
import { ForecastSection } from './ForecastSection.tsx';
import { LocationHeader } from './LocationHeader.tsx';
import { PollutantOverviewGrid } from './PollutantOverviewGrid.tsx';
import { formatIsoTimestamp } from './severityStyles.ts';
import { WinterSmogGuidancePanel } from './WinterSmogGuidancePanel.tsx';

export interface AirQualityDashboardProps {
  readonly userId: string;
  readonly profile: HouseholdLifestyleRecord;
  readonly apiClient: WebApiClient;
  readonly householdStore: HouseholdStore;
  readonly onProfileUpdated: (updated: HouseholdLifestyleRecord) => void;
  readonly onTelemetryUpdated?: ((syncToken: string) => void) | undefined;
  readonly onSessionIssue?: ((error: unknown) => void) | undefined;
}

export function AirQualityDashboard({
  userId,
  profile,
  apiClient,
  householdStore,
  onProfileUpdated,
  onTelemetryUpdated,
  onSessionIssue,
}: AirQualityDashboardProps) {
  const [selectedScale, setSelectedScale] = useState<AqiScaleId>('us_aqi');
  const [horizonHours, setHorizonHours] = useState<24 | 48>(24);
  const horizonHoursRef = useRef<24 | 48>(24);
  const lastFetchedLocationKeyRef = useRef<string | null>(null);
  const syncCounterRef = useRef(0);
  const [currentData, setCurrentData] = useState<AirQualityCurrentResponse | null>(null);
  const [forecastSeries, setForecastSeries] = useState<readonly HourlyForecastPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const locationKey = `${profile.country}|${profile.city}|${profile.neighborhood}|${profile.postalPrefix}`;

  const loadCurrentIntelligence = useCallback(
    async (opts?: {
      readonly silentRefresh?: boolean;
      readonly hours?: 24 | 48;
      readonly notifyDownstream?: boolean;
    }) => {
      const targetHours = opts?.hours ?? horizonHoursRef.current;
      if (opts?.silentRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLoadError(null);

      try {
        const response = await apiClient.getAirQualityCurrent({
          hours: targetHours,
          ...(opts?.silentRefresh ? { forceRefresh: true } : {}),
        });
        setCurrentData(response);
        setForecastSeries(response.forecastPreview);
        if (opts?.notifyDownstream !== false) {
          syncCounterRef.current += 1;
          onTelemetryUpdated?.(
            `${response.transparency.fetchedAt}:${response.transparency.freshnessStatus}:${syncCounterRef.current}`,
          );
        }
      } catch (error) {
        onSessionIssue?.(error);
        setLoadError(formatWorkspaceError(error, 'Air Quality Intelligence'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [apiClient, onSessionIssue, onTelemetryUpdated],
  );

  useEffect(() => {
    if (lastFetchedLocationKeyRef.current === locationKey) {
      return;
    }

    let cancelled = false;
    async function fetchOnMountOrLocationChange() {
      try {
        const response = await apiClient.getAirQualityCurrent({
          hours: horizonHoursRef.current,
        });
        if (!cancelled) {
          lastFetchedLocationKeyRef.current = locationKey;
          setCurrentData(response);
          setForecastSeries(response.forecastPreview);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          onSessionIssue?.(error);
          setLoadError(formatWorkspaceError(error, 'Air Quality Intelligence'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void fetchOnMountOrLocationChange();
    return () => {
      cancelled = true;
    };
  }, [apiClient, locationKey, onSessionIssue]);

  const handleChangeHorizon = useCallback(
    async (nextHours: 24 | 48) => {
      horizonHoursRef.current = nextHours;
      setHorizonHours(nextHours);
      setIsLoadingForecast(true);
      try {
        const forecastRes = await apiClient.getAirQualityForecast({ hours: nextHours });
        setForecastSeries(forecastRes.hourly);
      } catch (error) {
        onSessionIssue?.(error);
        setLoadError(formatWorkspaceError(error, 'Air Quality Forecast'));
      } finally {
        setIsLoadingForecast(false);
      }
    },
    [apiClient, onSessionIssue],
  );

  const handleUpdateLocation = useCallback(
    async (locationInput: LocationUpdateInput) => {
      setIsUpdatingLocation(true);
      setLocationNotice(null);
      try {
        const updatedLocation = await apiClient.updateAirQualityLocation({
          ...locationInput,
          primaryZoneType: profile.locationPreferences.primaryZoneType,
        });

        const nextProfileInput = {
          country: updatedLocation.location.country,
          city: updatedLocation.location.city,
          neighborhood: updatedLocation.location.neighborhood,
          postalPrefix: updatedLocation.location.postalPrefix,
          locationPreferences: {
            primaryZoneType: profile.locationPreferences.primaryZoneType,
            alertsEnabled: profile.locationPreferences.alertsEnabled,
          },
          householdSize: profile.householdSize,
          householdComposition: [...profile.householdComposition],
          primaryCommuteMode: profile.primaryCommuteMode,
          outdoorActivityPattern: profile.outdoorActivityPattern,
          ventilationContext: profile.ventilationContext,
          hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
          heatingType: profile.heatingType,
          lifestylePreferences: {
            preferredGuidanceFocus: profile.lifestylePreferences.preferredGuidanceFocus,
            reminderCadence: profile.lifestylePreferences.reminderCadence,
          },
          onboardingCompleted: profile.onboardingCompleted,
        };

        const saved = await householdStore.saveHouseholdProfile(userId, nextProfileInput);
        lastFetchedLocationKeyRef.current = `${saved.country}|${saved.city}|${saved.neighborhood}|${saved.postalPrefix}`;
        onProfileUpdated(saved);
        setLocationNotice(
          `Monitoring location updated to ${updatedLocation.location.neighborhood}, ${updatedLocation.location.city}, ${updatedLocation.location.country}.`,
        );
        await loadCurrentIntelligence({ silentRefresh: true, notifyDownstream: false });
      } catch (error) {
        onSessionIssue?.(error);
        throw error;
      } finally {
        setIsUpdatingLocation(false);
      }
    },
    [
      apiClient,
      householdStore,
      loadCurrentIntelligence,
      onProfileUpdated,
      onSessionIssue,
      profile,
      userId,
    ],
  );

  if (isLoading && !currentData) {
    return (
      <SurfaceCard as="section" aria-labelledby="aq-loading-heading">
        <output aria-live="polite" className="block space-y-2 text-sm text-slate-700">
          <p id="aq-loading-heading" className="font-semibold text-slate-950">
            Loading Air Quality Intelligence...
          </p>
          <p>
            Resolving coordinates for {profile.city}, {profile.country} and retrieving Open-Meteo
            atmospheric dispersion telemetry.
          </p>
        </output>
      </SurfaceCard>
    );
  }

  if (loadError && !currentData) {
    return (
      <AlertBanner tone="error" title="Air quality telemetry request failed">
        <p>{loadError}</p>
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={() => void loadCurrentIntelligence()}>
            Retry telemetry check
          </Button>
        </div>
      </AlertBanner>
    );
  }

  if (!currentData) {
    return null;
  }

  const { location, aqi, pollutants, guidance, transparency } = currentData;

  return (
    <div className="space-y-6" data-testid="air-quality-dashboard">
      {locationNotice ? (
        <AlertBanner tone="success" title="Monitoring location updated">
          <p>{locationNotice}</p>
        </AlertBanner>
      ) : null}

      {loadError ? (
        <AlertBanner tone="error" title="Telemetry refresh notice">
          <p>{loadError}</p>
        </AlertBanner>
      ) : null}

      {transparency.freshnessStatus === 'stale' ? (
        <AlertBanner tone="warning" title="Displaying cached air quality readings (stale fallback)">
          <p>
            {transparency.fallbackReason ??
              'Live retrieval is temporarily unavailable; displaying cached readings.'}{' '}
            Original observation timestamp:{' '}
            <span className="font-mono tabular-nums">
              {formatIsoTimestamp(transparency.observationTimestamp, location.timezone)}
            </span>
            .
          </p>
        </AlertBanner>
      ) : null}

      {transparency.freshnessStatus === 'unavailable' ? (
        <AlertBanner tone="warning" title="Live air quality data temporarily unavailable">
          <p>
            {transparency.fallbackReason ??
              'No live or recent cached readings are available for this location.'}{' '}
            No placeholder or fabricated AQI figures are shown. General clean-air precautions remain
            active below.
          </p>
        </AlertBanner>
      ) : null}

      <LocationHeader
        location={location}
        transparency={transparency}
        isRefreshing={isRefreshing}
        isUpdatingLocation={isUpdatingLocation}
        onRefresh={() => void loadCurrentIntelligence({ silentRefresh: true })}
        onUpdateLocation={handleUpdateLocation}
      />

      <AqiSummaryCard
        usAqi={aqi.usAqi}
        europeanAqi={aqi.europeanAqi}
        dominantPollutant={aqi.dominantPollutant}
        selectedScale={selectedScale}
        onSelectScale={setSelectedScale}
      />

      <PollutantOverviewGrid pollutants={pollutants} />

      <ForecastSection
        hourly={forecastSeries}
        horizonHours={horizonHours}
        timezone={location.timezone}
        transparency={transparency}
        isLoadingForecast={isLoadingForecast}
        onChangeHorizon={(hours) => void handleChangeHorizon(hours)}
      />

      <WinterSmogGuidancePanel guidance={guidance} />

      <DataTransparencyPanel transparency={transparency} location={location} />
    </div>
  );
}
