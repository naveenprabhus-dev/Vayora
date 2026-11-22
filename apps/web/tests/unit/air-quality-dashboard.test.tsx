import type {
  AirQualityCurrentResponse,
  AirQualityForecastResponse,
  HouseholdLifestyleRecord,
} from '@uaqa/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AirQualityDashboard } from '../../src/features/air-quality/AirQualityDashboard.tsx';
import type { WebApiClient } from '../../src/lib/apiClient.ts';
import type { HouseholdStore } from '../../src/lib/householdStore.ts';

const SAMPLE_PROFILE: HouseholdLifestyleRecord = {
  ownerUid: 'uid_verified_family',
  country: 'Poland',
  city: 'Krakow',
  neighborhood: 'Krowodrza',
  postalPrefix: '30-01',
  locationPreferences: {
    primaryZoneType: 'valley_basin',
    alertsEnabled: true,
  },
  householdSize: 4,
  householdComposition: ['adults', 'young_children'],
  primaryCommuteMode: 'public_transit',
  outdoorActivityPattern: 'school_run_family',
  ventilationContext: 'filtered_hvac_merv13',
  hasIndoorAirPurifier: true,
  heatingType: 'district',
  lifestylePreferences: {
    preferredGuidanceFocus: 'indoor_air',
    reminderCadence: 'daily_smog_alerts',
  },
  onboardingCompleted: true,
};

function buildCurrentPayload(
  overrides?: Partial<AirQualityCurrentResponse>,
): AirQualityCurrentResponse {
  return {
    location: {
      city: 'Krakow',
      neighborhood: 'Krowodrza',
      country: 'Poland',
      postalPrefix: '30-01',
      resolvedLabel: 'Krakow, Poland',
      latitude: 50.061,
      longitude: 19.937,
      timezone: 'Europe/Warsaw',
      resolutionSource: 'saved_profile_geocoded',
    },
    aqi: {
      usAqi: {
        scale: 'us_aqi',
        scaleLabel: 'US AQI (EPA)',
        authorityLabel: 'U.S. EPA 0–500 Scale (40 CFR Part 58 Appendix G)',
        value: 112,
        status: 'available',
        category: 'Unhealthy for Sensitive Groups',
        pollutionLevel: 'moderate',
        pollutionLevelLabel: 'Moderate–elevated pollution level',
        severityToken: 'elevated',
        meaning: 'Elevated fine particulates along valley corridors.',
        precautionSummary: 'Run indoor HEPA filtration and shorten strenuous outdoor play.',
        methodologyNote: 'US AQI reports the highest individual pollutant sub-index.',
      },
      europeanAqi: {
        scale: 'european_aqi',
        scaleLabel: 'European AQI (EEA)',
        authorityLabel: 'European Environment Agency (EEA) 0–100+ Index',
        value: 68,
        status: 'available',
        category: 'Poor',
        pollutionLevel: 'high',
        pollutionLevelLabel: 'High pollution level',
        severityToken: 'high',
        meaning: 'Elevated particulate dispersion risk.',
        precautionSummary: 'Ventilate briefly outside peak traffic hours.',
        methodologyNote: 'EEA uses six distinct concentration bands.',
      },
      dominantPollutant: {
        status: 'available',
        code: 'pm2_5',
        abbreviation: 'PM2.5',
        fullName: 'Fine Particulate Matter',
        basis: 'provider_sub_index',
        estimatedSubIndex: 112,
        explanation: 'Fine Particulate Matter (PM2.5) (40.2 µg/m³) is the leading contributor.',
      },
    },
    pollutants: [
      {
        code: 'pm2_5',
        fullName: 'Fine Particulate Matter',
        abbreviation: 'PM2.5',
        concentration: 40.2,
        unit: 'µg/m³',
        status: 'available',
        concentrationBand: 'elevated',
        concentrationBandLabel: 'Elevated concentration',
        explanation: 'Tiny combustion particles.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
      {
        code: 'pm10',
        fullName: 'Coarse Particulate Matter',
        abbreviation: 'PM10',
        concentration: 55.4,
        unit: 'µg/m³',
        status: 'available',
        concentrationBand: 'moderate',
        concentrationBandLabel: 'Moderate concentration',
        explanation: 'Inhalable coarse dust and aerosols.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
      {
        code: 'no2',
        fullName: 'Nitrogen Dioxide',
        abbreviation: 'NO2',
        concentration: null,
        unit: 'µg/m³',
        status: 'unavailable',
        concentrationBand: 'unavailable',
        concentrationBandLabel: 'Unavailable',
        explanation: 'Traffic combustion gas.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
      {
        code: 'so2',
        fullName: 'Sulfur Dioxide',
        abbreviation: 'SO2',
        concentration: 11.2,
        unit: 'µg/m³',
        status: 'available',
        concentrationBand: 'low',
        concentrationBandLabel: 'Low concentration',
        explanation: 'Sulfur fuel combustion gas.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
      {
        code: 'co',
        fullName: 'Carbon Monoxide',
        abbreviation: 'CO',
        concentration: 520,
        unit: 'µg/m³',
        status: 'available',
        concentrationBand: 'low',
        concentrationBandLabel: 'Low concentration',
        explanation: 'Incomplete combustion gas.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
      {
        code: 'o3',
        fullName: 'Ground-Level Ozone',
        abbreviation: 'O3',
        concentration: 38.0,
        unit: 'µg/m³',
        status: 'available',
        concentrationBand: 'low',
        concentrationBandLabel: 'Low concentration',
        explanation: 'Photochemical surface oxidant.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
    ],
    forecastPreview: [
      {
        timestamp: '2026-11-22T12:00:00Z',
        usAqi: 112,
        europeanAqi: 68,
        pm25: 40.2,
        pm10: 55.4,
        no2: null,
        so2: 11.2,
        co: 520,
        o3: 38,
        availability: 'partial',
      },
      {
        timestamp: '2026-11-22T13:00:00Z',
        usAqi: 98,
        europeanAqi: 59,
        pm25: 34.0,
        pm10: 48.0,
        no2: 30.0,
        so2: 10.0,
        co: 490,
        o3: 41,
        availability: 'available',
      },
    ],
    guidance: {
      status: 'measured_evidence',
      headline: 'Elevated Smog Alert — Active Exposure Reduction (PM2.5)',
      summary: 'Prioritize filtered indoor air and shorter outdoor exertion.',
      fogDistinctionNote:
        'Cold air or ordinary water-vapor fog alone does not mean winter smog is high.',
      guidanceScopeNote: 'General evidence-based air quality guidance.',
      actions: [
        {
          id: 'high-ventilation',
          category: 'ventilation',
          title: 'Keep windows sealed and filter indoor air',
          recommendation: 'Run your HEPA purifier continuously during evening inversion peaks.',
          evidenceBasis: 'Elevated PM2.5.',
        },
      ],
    },
    transparency: {
      providerId: 'open-meteo',
      providerName: 'Open-Meteo Air Quality & Geocoding API',
      dataNature: 'model_forecast',
      dataNatureDisclosure:
        'Model-generated atmospheric chemistry estimate and hourly forecast from Open-Meteo (not direct ground-station sensor measurements).',
      attribution: 'Data provided by Open-Meteo.com (CC BY 4.0)',
      freshnessStatus: 'fresh',
      availabilityStatus: 'partial',
      observationTimestamp: '2026-11-22T12:00:00Z',
      fetchedAt: '2026-11-22T12:02:00Z',
      cacheAgeSeconds: 0,
      fallbackActive: false,
      fallbackReason: null,
      methodologySummary:
        'US AQI uses US EPA 0–500 pollutant-specific breakpoints; European AQI uses the EEA 0–100+ threshold scale.',
    },
    ...overrides,
  };
}

function createMockClients(currentPayload: AirQualityCurrentResponse) {
  const apiClient = {
    getAirQualityCurrent: vi.fn(async () => currentPayload),
    getAirQualityForecast: vi.fn(async ({ hours = 48 }): Promise<AirQualityForecastResponse> => ({
      location: currentPayload.location,
      horizonHours: hours,
      dataNature: 'model_forecast',
      units: { usAqi: 'US AQI', europeanAqi: 'EAQI', pollutants: 'µg/m³' },
      hourly: currentPayload.forecastPreview,
      transparency: currentPayload.transparency,
    })),
    updateAirQualityLocation: vi.fn(async (input) => ({
      location: {
        ...currentPayload.location,
        city: input.city,
        neighborhood: input.neighborhood,
        country: input.country,
        postalPrefix: input.postalPrefix,
        latitude: 52.23,
        longitude: 21.012,
      },
      updatedAt: '2026-11-22T12:15:00Z',
    })),
  } as unknown as WebApiClient;

  const householdStore: HouseholdStore = {
    syncVerifiedUserAccount: vi.fn(async () => {}),
    getHouseholdProfile: vi.fn(async () => SAMPLE_PROFILE),
    saveHouseholdProfile: vi.fn(async (uid, input) => ({ ownerUid: uid, ...input })),
  };

  return { apiClient, householdStore };
}

afterEach(() => {
  cleanup();
});

describe('VAYORA AirQualityDashboard (Unit & WCAG 2.2 AA)', () => {
  it('renders live US & EU AQI separately, 6 pollutants with honest Unavailable state, and accessible forecast table toggle', async () => {
    const payload = buildCurrentPayload();
    const { apiClient, householdStore } = createMockClients(payload);
    const onProfileUpdated = vi.fn();

    const { container } = render(
      <AirQualityDashboard
        userId="uid_verified_family"
        profile={SAMPLE_PROFILE}
        apiClient={apiClient}
        householdStore={householdStore}
        onProfileUpdated={onProfileUpdated}
      />,
    );

    expect(await screen.findByTestId('air-quality-dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Krowodrza, Krakow, Poland/)).toBeInTheDocument();
    expect(
      screen.getAllByText(/not direct ground-station sensor measurements/i).length,
    ).toBeGreaterThanOrEqual(1);

    // Separate US AQI & European AQI switching
    expect(screen.getByTestId('primary-aqi-value')).toHaveTextContent('112');
    expect(screen.getByTestId('companion-aqi-value')).toHaveTextContent('68');

    fireEvent.click(screen.getByRole('button', { name: 'European AQI (EEA)' }));
    expect(screen.getByTestId('primary-aqi-value')).toHaveTextContent('68');
    expect(screen.getByTestId('companion-aqi-value')).toHaveTextContent('112');

    // Missing pollutant (NO2) explicitly reads Unavailable
    expect(screen.getByTestId('pollutant-value-pm2_5')).toHaveTextContent('40.2');
    expect(screen.getByTestId('pollutant-value-no2')).toHaveTextContent('Unavailable');

    // Toggle forecast to semantic accessible table view and fetch 48h horizon
    fireEvent.click(screen.getByRole('button', { name: '48h forecast' }));
    await waitFor(() => {
      expect(apiClient.getAirQualityForecast).toHaveBeenCalledWith({ hours: 48 });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));
    expect(screen.getByRole('table')).toBeInTheDocument();

    const axeResults = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    });
    expect(axeResults.violations).toEqual([]);
  });

  it('supports updating saved location inline and propagates update cleanly', async () => {
    const payload = buildCurrentPayload();
    const { apiClient, householdStore } = createMockClients(payload);
    const onProfileUpdated = vi.fn();

    render(
      <AirQualityDashboard
        userId="uid_verified_family"
        profile={SAMPLE_PROFILE}
        apiClient={apiClient}
        householdStore={householdStore}
        onProfileUpdated={onProfileUpdated}
      />,
    );

    await screen.findByTestId('air-quality-dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Change location' }));

    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Warsaw' } });
    fireEvent.change(screen.getByLabelText(/Neighborhood or district/), {
      target: { value: 'Mokotow' },
    });
    fireEvent.change(screen.getByLabelText(/Postal prefix/), { target: { value: '02-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save location' }));

    await waitFor(() => {
      expect(apiClient.updateAirQualityLocation).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Warsaw', neighborhood: 'Mokotow' }),
      );
      expect(householdStore.saveHouseholdProfile).toHaveBeenCalled();
      expect(onProfileUpdated).toHaveBeenCalled();
    });
  });

  it('displays clear stale-cache and unavailable-data fallback banners with general precautions', async () => {
    const stalePayload = buildCurrentPayload({
      transparency: {
        ...buildCurrentPayload().transparency,
        freshnessStatus: 'stale',
        fallbackActive: true,
        fallbackReason: 'Upstream Open-Meteo timeout.',
      },
    });
    const { apiClient, householdStore } = createMockClients(stalePayload);

    render(
      <AirQualityDashboard
        userId="uid_verified_family"
        profile={SAMPLE_PROFILE}
        apiClient={apiClient}
        householdStore={householdStore}
        onProfileUpdated={vi.fn()}
      />,
    );

    expect(await screen.findByText(/Displaying cached air quality readings/i)).toBeInTheDocument();

    cleanup();
    const unavailablePayload = buildCurrentPayload({
      aqi: {
        usAqi: {
          ...buildCurrentPayload().aqi.usAqi,
          value: null,
          status: 'unavailable',
          category: 'Unavailable',
          severityToken: 'unavailable',
        },
        europeanAqi: {
          ...buildCurrentPayload().aqi.europeanAqi,
          value: null,
          status: 'unavailable',
          category: 'Unavailable',
          severityToken: 'unavailable',
        },
        dominantPollutant: {
          status: 'unavailable',
          code: null,
          abbreviation: null,
          fullName: null,
          basis: 'unavailable',
          estimatedSubIndex: null,
          explanation: 'Insufficient pollutant readings.',
        },
      },
      forecastPreview: [],
      transparency: {
        ...buildCurrentPayload().transparency,
        dataNature: 'unavailable',
        freshnessStatus: 'unavailable',
        availabilityStatus: 'unavailable',
        fallbackActive: true,
        fallbackReason: 'Provider unreachable.',
      },
    });
    const offlineMocks = createMockClients(unavailablePayload);

    render(
      <AirQualityDashboard
        userId="uid_verified_family"
        profile={SAMPLE_PROFILE}
        apiClient={offlineMocks.apiClient}
        householdStore={offlineMocks.householdStore}
        onProfileUpdated={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/Live air quality data temporarily unavailable/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('primary-aqi-value')).toHaveTextContent('Unavailable');
  });
});
