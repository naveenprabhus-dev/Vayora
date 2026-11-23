import type { HouseholdLifestyleRecord, DailyRoutineResponse } from '@uaqa/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyRoutinesWorkspace } from '../../src/features/routines/DailyRoutinesWorkspace.tsx';
import type { WebApiClient } from '../../src/lib/apiClient.ts';

async function runAxeAudit(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    },
  });
  expect(results.violations).toEqual([]);
}

const MOCK_PROFILE: HouseholdLifestyleRecord = {
  ownerUid: 'uid_test_family',
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
  primaryCommuteMode: 'gas_vehicle',
  outdoorActivityPattern: 'school_run_family',
  ventilationContext: 'natural_windows',
  hasIndoorAirPurifier: true,
  heatingType: 'district',
  lifestylePreferences: {
    preferredGuidanceFocus: 'balanced',
    reminderCadence: 'daily_smog_alerts',
  },
  onboardingCompleted: true,
};

const MOCK_ROUTINE_RESPONSE: DailyRoutineResponse = {
  routineId: 'uid_test_family::test_hash',
  generatedAt: '2026-11-22T12:00:00Z',
  cachedResult: false,
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
  profileContext: {
    primaryZoneType: 'valley_basin',
    householdSize: 4,
    householdComposition: ['adults', 'young_children'],
    savedCommuteMode: 'gas_vehicle',
    effectiveCommuteMode: 'gas_vehicle',
    savedOutdoorPattern: 'school_run_family',
    effectiveOutdoorPattern: 'school_run_family',
    heatingType: 'district',
    ventilationContext: 'natural_windows',
    hasIndoorAirPurifier: true,
    preferredGuidanceFocus: 'balanced',
    isScenarioPreview: false,
  },
  airQualityContext: {
    usAqi: {
      scale: 'us_aqi',
      scaleLabel: 'US AQI (EPA)',
      authorityLabel: 'U.S. EPA 0–500 Scale',
      value: 78,
      status: 'available',
      category: 'Moderate',
      pollutionLevel: 'moderate',
      pollutionLevelLabel: 'Moderate pollution level',
      severityToken: 'moderate',
      meaning: 'Moderate particulate accumulation.',
      precautionSummary: 'Keep physical outdoor exertion moderate.',
      methodologyNote: 'US AQI reports highest pollutant sub-index.',
    },
    europeanAqi: {
      scale: 'european_aqi',
      scaleLabel: 'European AQI (EEA)',
      authorityLabel: 'EEA 0–100+ Index',
      value: 52,
      status: 'available',
      category: 'Moderate',
      pollutionLevel: 'moderate',
      pollutionLevelLabel: 'Moderate pollution level',
      severityToken: 'moderate',
      meaning: 'Fair to moderate air quality.',
      precautionSummary: 'Prefer lower traffic corridors.',
      methodologyNote: 'EEA bands 0 to 100+.',
    },
    dominantPollutant: {
      status: 'available',
      code: 'pm2_5',
      abbreviation: 'PM2.5',
      fullName: 'Fine Particulate Matter',
      basis: 'provider_sub_index',
      estimatedSubIndex: 78,
      explanation: 'Fine Particulate Matter (PM2.5) drives current AQI.',
    },
    pollutants: [
      {
        code: 'pm2_5',
        fullName: 'Fine Particulate Matter',
        abbreviation: 'PM2.5',
        concentration: 24.5,
        unit: 'µg/m³',
        status: 'available',
        concentrationBand: 'moderate',
        concentrationBandLabel: 'Moderate concentration',
        explanation: 'Fine particles.',
        distinctionNote: 'µg/m³ mass concentration.',
      },
    ],
    transparency: {
      providerId: 'open-meteo',
      providerName: 'Open-Meteo',
      dataNature: 'model_forecast',
      dataNatureDisclosure: 'Model forecast from Open-Meteo.',
      attribution: 'Open-Meteo CC BY 4.0',
      freshnessStatus: 'fresh',
      availabilityStatus: 'available',
      observationTimestamp: '2026-11-22T12:00:00Z',
      fetchedAt: '2026-11-22T12:01:00Z',
      cacheAgeSeconds: 15,
      fallbackActive: false,
      fallbackReason: null,
      methodologySummary: 'EPA and EEA scales reported independently.',
    },
  },
  overview: {
    headline: 'Balanced Low-Emission Daily Routine (Krakow)',
    summary: 'Proportionate ventilation timing and exposure precautions for your household.',
    totalRecommended: 4,
    totalOptional: 2,
    totalUnavailable: 0,
    exposureCount: 3,
    emissionCount: 2,
    bothCount: 1,
    safetyAndScopeNotice: 'Evidence-based guidance only. Zero medical diagnoses.',
  },
  betterTimeWindows: {
    status: 'available',
    windows: [
      {
        id: 'win-midday',
        period: 'midday',
        startTimestamp: '2026-11-22T11:00:00Z',
        endTimestamp: '2026-11-22T14:00:00Z',
        label: 'Midday dispersion window (11:00 – 14:00)',
        usAqiMin: 62,
        usAqiMax: 74,
        europeanAqiMin: 40,
        europeanAqiMax: 48,
        dataBasis: 'model_forecast',
        rationale: 'Slight thermal lift lowers ground-level PM2.5 temporarily.',
        cautionNote: 'Conditions remain weather-dependent.',
      },
    ],
    limitationDisclosure: 'Model-derived forecast windows.',
  },
  commuteSummary: {
    savedMode: 'gas_vehicle',
    effectiveMode: 'gas_vehicle',
    headline: 'Commute & Travel Strategy (Gas vehicle)',
    exposureVsEmissionsNote:
      'Shifting to public transit reduces both local emissions and inhalation exposure.',
    options: [
      {
        id: 'commute-option-1',
        modeLabel: 'Public Transit / Carpool',
        status: 'recommended',
        statusReason: 'Lowers city-wide tailpipe emissions.',
        impactType: 'both',
        impactLabel: 'Exposure & emissions',
        summary: 'Take bus or train for your daily commute.',
        reason: 'Reduces vehicle tailpipe emissions.',
        infrastructureNote: 'Assumes established neighborhood transit schedules.',
      },
    ],
  },
  periods: [
    {
      period: 'morning',
      label: 'Morning',
      windowHint: '06:00 – 10:00',
      periodSummary: 'Manage inversion accumulation during peak morning traffic.',
      items: [
        {
          id: 'morning-school-family-routine',
          period: 'morning',
          category: 'outdoor_activity',
          title: 'Timing the morning school run & walking route',
          status: 'recommended',
          statusReason: 'Avoid peak roadside vehicle idling.',
          priorityScore: 90,
          suggestedWindow: '08:00 – 08:30',
          impactType: 'exposure_reduction',
          impactLabel: 'Personal exposure',
          explanation: {
            whatToDo: 'Choose side streets away from arterial bus routes for the school walk.',
            whyRecommended:
              'Roadside particulate concentration peaks during cold morning rush hours.',
            influencingData: ['US AQI 78 (Moderate)', 'PM2.5 concentration 24.5 µg/m³'],
            expectedBenefit: 'Lowers direct inhalation during sensitive morning hours.',
            limitationsAndTradeoffs: 'Walk duration may increase slightly.',
          },
          airQualityContext: 'US AQI 78 with elevated PM2.5.',
          practicalAlternative:
            'Drive with cabin air recirculation enabled if walking is not feasible.',
          freshnessAndUncertainty: 'Based on fresh model forecast.',
          informationBasis: 'rule_derived',
        },
      ],
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe('DailyRoutinesWorkspace Component', () => {
  it('renders daily routines overview, AQI time windows, commute strategy, and action cards correctly', async () => {
    const apiClient: WebApiClient = {
      getHealth: vi.fn(),
      getAuthSession: vi.fn(),
      verifyToken: vi.fn(),
      requestPasswordResetAudit: vi.fn(),
      getHouseholdProfile: vi.fn(),
      saveHouseholdProfile: vi.fn(),
      validateHouseholdProfile: vi.fn(),
      getAirQualityCurrent: vi.fn(),
      getAirQualityForecast: vi.fn(),
      getAirQualityPollutants: vi.fn(),
      getAirQualityGuidance: vi.fn(),
      getAirQualityHealth: vi.fn(),
      updateAirQualityLocation: vi.fn(),
      getDailyRoutines: vi.fn(async () => MOCK_ROUTINE_RESPONSE),
      refreshDailyRoutines: vi.fn(async () => MOCK_ROUTINE_RESPONSE),
    };

    const { container } = render(
      <DailyRoutinesWorkspace profile={MOCK_PROFILE} apiClient={apiClient} />,
    );

    expect(await screen.findByTestId('daily-routines-workspace')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Balanced Low-Emission Daily Routine/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /Comparatively Better Outdoor Time Windows/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: /Timing the morning school run/i }),
    ).toBeInTheDocument();

    await runAxeAudit(container);
  });
});
