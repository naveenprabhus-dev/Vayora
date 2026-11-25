import type {
  AlternativeComparisonView,
  HouseholdLifestyleInput,
  HouseholdLifestyleRecord,
  IndoorAirGuidanceResponse,
  SustainableAlternativesResponse,
} from '@uaqa/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App.tsx';
import { ApiClientError, type WebApiClient } from '../../src/lib/apiClient.ts';
import {
  AuthServiceError,
  type AuthService,
  type AuthUserSnapshot,
} from '../../src/lib/authService.ts';
import type { HouseholdStore } from '../../src/lib/householdStore.ts';

async function runAxeAudit(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    },
  });
  expect(results.violations).toEqual([]);
}

function createHarness(options?: {
  initialUser?: AuthUserSnapshot | null;
  initialProfile?: HouseholdLifestyleRecord | null;
}) {
  let currentUser: AuthUserSnapshot | null = options?.initialUser ?? null;
  let storedProfile: HouseholdLifestyleRecord | null = options?.initialProfile ?? null;
  let subscriber: ((user: AuthUserSnapshot | null) => void) | null = null;

  const authService: AuthService = {
    subscribeAuthState(onChange) {
      subscriber = onChange;
      onChange(currentUser);
      return () => {
        subscriber = null;
      };
    },
    async register(input) {
      if (input.email === 'duplicate@household.org') {
        throw new AuthServiceError(
          'auth/email-already-in-use',
          'An account with this email address already exists. Sign in or recover your password.',
        );
      }
      currentUser = {
        uid: 'uid_new_family',
        email: input.email,
        displayName: input.displayName,
        emailVerified: false,
      };
      return currentUser;
    },
    async login(input) {
      if (input.password === 'WrongPassword1!') {
        throw new AuthServiceError('auth/invalid-credential', 'Invalid email address or password.');
      }
      currentUser = {
        uid: 'uid_verified_family',
        email: input.email,
        displayName: 'Elena Nowak',
        emailVerified: true,
      };
      subscriber?.(currentUser);
      return currentUser;
    },
    async logout() {
      currentUser = null;
      subscriber?.(null);
    },
    resendVerificationEmail: vi.fn(async () => {}),
    async refreshCurrentUser() {
      if (currentUser) {
        currentUser = { ...currentUser, emailVerified: true };
      }
      return currentUser;
    },
    async getFreshIdToken() {
      return currentUser ? 'valid-firebase-id-token' : null;
    },
    sendPasswordReset: vi.fn(async () => {}),
    verifyResetCode: vi.fn(async (oobCode: string) => {
      if (oobCode === 'expired-code-999') {
        throw new AuthServiceError(
          'auth/expired-action-code',
          'This link has expired. Request a new verification or password reset email.',
        );
      }
    }),
    confirmReset: vi.fn(async () => {}),
    applyEmailVerificationCode: vi.fn(async () => {}),
  };

  const householdStore: HouseholdStore = {
    syncVerifiedUserAccount: vi.fn(async () => {}),
    async getHouseholdProfile() {
      return storedProfile;
    },
    async saveHouseholdProfile(uid: string, input: HouseholdLifestyleInput) {
      storedProfile = { ownerUid: uid, ...input };
      return storedProfile;
    },
  };

  const apiClient: WebApiClient = {
    getHealth: vi.fn(async () => ({
      status: 'ok' as const,
      service: 'urban-air-quality-api' as const,
      version: '0.1.0',
      environment: 'test',
      uptimeSeconds: 1,
    })),
    getAuthSession: vi.fn(async () => ({
      authenticated: true as const,
      principal: {
        uid: currentUser?.uid ?? 'uid_verified_family',
        email: currentUser?.email ?? 'elena@household.org',
        emailVerified: currentUser?.emailVerified ?? true,
        role: 'regular_user' as const,
        authTimeSeconds: 1700000100,
      },
    })),
    verifyToken: vi.fn(async () => ({
      verified: true as const,
      principal: {
        uid: 'uid_verified_family',
        email: 'elena@household.org',
        emailVerified: true,
        role: 'regular_user' as const,
        authTimeSeconds: 1700000100,
      },
    })),
    requestPasswordResetAudit: vi.fn(async () => ({
      accepted: true,
      message:
        'If an account exists for that email address, password reset instructions have been sent.',
    })),
    getHouseholdProfile: vi.fn(async () => {
      if (!storedProfile) {
        throw new ApiClientError({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Household profile has not been completed yet.',
          requestId: 'req-test-404',
        });
      }
      return { profile: storedProfile };
    }),
    saveHouseholdProfile: vi.fn(async (input: HouseholdLifestyleInput) => {
      storedProfile = { ownerUid: currentUser?.uid ?? 'uid_verified_family', ...input };
      return { profile: storedProfile };
    }),
    validateHouseholdProfile: vi.fn(async () => ({
      valid: true as const,
      ownerUid: 'uid_verified_family',
    })),
    getAirQualityCurrent: vi.fn(async () => ({
      location: {
        city: storedProfile?.city ?? 'Krakow',
        neighborhood: storedProfile?.neighborhood ?? 'Krowodrza',
        country: storedProfile?.country ?? 'Poland',
        postalPrefix: storedProfile?.postalPrefix ?? '30-01',
        resolvedLabel: `${storedProfile?.city ?? 'Krakow'}, ${storedProfile?.country ?? 'Poland'}`,
        latitude: 50.061,
        longitude: 19.937,
        timezone: 'Europe/Warsaw',
        resolutionSource: 'saved_profile_geocoded' as const,
      },
      aqi: {
        usAqi: {
          scale: 'us_aqi' as const,
          scaleLabel: 'US AQI (EPA)',
          authorityLabel: 'U.S. EPA 0–500 Scale',
          value: 74,
          status: 'available' as const,
          category: 'Moderate',
          pollutionLevel: 'moderate' as const,
          pollutionLevelLabel: 'Moderate pollution level',
          severityToken: 'moderate' as const,
          meaning: 'Air quality is acceptable for daily routines.',
          precautionSummary: 'Consider shorter peak-traffic outdoor exercise.',
          methodologyNote: 'US AQI reports the highest individual pollutant index.',
        },
        europeanAqi: {
          scale: 'european_aqi' as const,
          scaleLabel: 'European AQI (EEA)',
          authorityLabel: 'EEA 0–100+ Index',
          value: 48,
          status: 'available' as const,
          category: 'Moderate',
          pollutionLevel: 'moderate' as const,
          pollutionLevelLabel: 'Moderate pollution level',
          severityToken: 'moderate' as const,
          meaning: 'Moderate urban pollutant accumulation.',
          precautionSummary: 'Prefer quieter low-traffic routes.',
          methodologyNote: 'EEA uses 6 concentration bands.',
        },
        dominantPollutant: {
          status: 'available' as const,
          code: 'pm2_5' as const,
          abbreviation: 'PM2.5',
          fullName: 'Fine Particulate Matter',
          basis: 'provider_sub_index' as const,
          estimatedSubIndex: 74,
          explanation: 'Fine Particulate Matter (PM2.5) is the leading driver.',
        },
      },
      pollutants: [
        {
          code: 'pm2_5' as const,
          fullName: 'Fine Particulate Matter',
          abbreviation: 'PM2.5',
          concentration: 22.8,
          unit: 'µg/m³',
          status: 'available' as const,
          concentrationBand: 'moderate' as const,
          concentrationBandLabel: 'Moderate concentration',
          explanation: 'Fine inhalable particles under 2.5 micrometers.',
          distinctionNote: 'Mass concentration in µg/m³.',
        },
      ],
      forecastPreview: [
        {
          timestamp: '2026-11-22T12:00:00Z',
          usAqi: 74,
          europeanAqi: 48,
          pm25: 22.8,
          pm10: 34.1,
          no2: 28.0,
          so2: 6.2,
          co: 410,
          o3: 44.0,
          availability: 'available' as const,
        },
      ],
      guidance: {
        status: 'measured_evidence' as const,
        headline: 'Moderate Air Pollution — Targeted Exposure Steps (PM2.5)',
        summary: 'Proportionate routing and ventilation help keep household exposure low.',
        fogDistinctionNote: 'Cold air or fog alone is distinct from particulate smog.',
        guidanceScopeNote: 'General evidence-based guidance.',
        actions: [
          {
            id: 'mod-ventilation',
            category: 'ventilation' as const,
            title: 'Ventilate briefly outside peak traffic hours',
            recommendation: 'Run your HEPA purifier on medium setting.',
            evidenceBasis: 'Saved ventilation context.',
          },
        ],
      },
      transparency: {
        providerId: 'open-meteo' as const,
        providerName: 'Open-Meteo Air Quality & Geocoding API',
        dataNature: 'model_forecast' as const,
        dataNatureDisclosure: 'Model-generated atmospheric chemistry estimate from Open-Meteo.',
        attribution: 'Data provided by Open-Meteo.com (CC BY 4.0)',
        freshnessStatus: 'fresh' as const,
        availabilityStatus: 'available' as const,
        observationTimestamp: '2026-11-22T12:00:00Z',
        fetchedAt: '2026-11-22T12:02:00Z',
        cacheAgeSeconds: 12,
        fallbackActive: false,
        fallbackReason: null,
        methodologySummary: 'US AQI and European EEA scales reported separately.',
      },
    })),
    getAirQualityForecast: vi.fn(),
    getAirQualityPollutants: vi.fn(),
    getAirQualityGuidance: vi.fn(),
    getAirQualityHealth: vi.fn(),
    updateAirQualityLocation: vi.fn(),
    getDailyRoutines: vi.fn(async () => ({
      routineId: 'test-routine-id',
      generatedAt: '2026-11-22T12:00:00Z',
      cachedResult: false,
      location: {
        city: storedProfile?.city ?? 'Krakow',
        neighborhood: storedProfile?.neighborhood ?? 'Krowodrza',
        country: storedProfile?.country ?? 'Poland',
        postalPrefix: '30-01',
        resolvedLabel: 'Krakow, Poland',
        latitude: 50.061,
        longitude: 19.937,
        timezone: 'Europe/Warsaw',
        resolutionSource: 'saved_profile_geocoded' as const,
      },
      profileContext: {
        primaryZoneType: 'valley_basin' as const,
        householdSize: 4,
        householdComposition: [
          'adults',
          'young_children',
        ] as HouseholdLifestyleRecord['householdComposition'],
        savedCommuteMode: 'gas_vehicle' as const,
        effectiveCommuteMode: 'gas_vehicle' as const,
        savedOutdoorPattern: 'school_run_family' as const,
        effectiveOutdoorPattern: 'school_run_family' as const,
        heatingType: 'district' as const,
        ventilationContext: 'natural_windows' as const,
        hasIndoorAirPurifier: true,
        preferredGuidanceFocus: 'balanced' as const,
        isScenarioPreview: false,
      },
      airQualityContext: {
        usAqi: {
          scale: 'us_aqi' as const,
          scaleLabel: 'US AQI (EPA)',
          authorityLabel: 'U.S. EPA 0–500 Scale',
          value: 74,
          status: 'available' as const,
          category: 'Moderate',
          pollutionLevel: 'moderate' as const,
          pollutionLevelLabel: 'Moderate pollution level',
          severityToken: 'moderate' as const,
          meaning: 'Air quality is acceptable.',
          precautionSummary: 'Consider shorter outdoor exercise.',
          methodologyNote: 'US AQI.',
        },
        europeanAqi: {
          scale: 'european_aqi' as const,
          scaleLabel: 'European AQI (EEA)',
          authorityLabel: 'EEA 0–100+ Index',
          value: 48,
          status: 'available' as const,
          category: 'Moderate',
          pollutionLevel: 'moderate' as const,
          pollutionLevelLabel: 'Moderate pollution level',
          severityToken: 'moderate' as const,
          meaning: 'EEA moderate.',
          precautionSummary: 'Quiet routes.',
          methodologyNote: 'EEA bands.',
        },
        dominantPollutant: {
          status: 'available' as const,
          code: 'pm2_5' as const,
          abbreviation: 'PM2.5',
          fullName: 'Fine Particulate Matter',
          basis: 'provider_sub_index' as const,
          estimatedSubIndex: 74,
          explanation: 'Fine PM2.5.',
        },
        pollutants: [],
        transparency: {
          providerId: 'open-meteo' as const,
          providerName: 'Open-Meteo',
          dataNature: 'model_forecast' as const,
          dataNatureDisclosure: 'Model forecast.',
          attribution: 'Open-Meteo CC BY 4.0',
          freshnessStatus: 'fresh' as const,
          availabilityStatus: 'available' as const,
          observationTimestamp: '2026-11-22T12:00:00Z',
          fetchedAt: '2026-11-22T12:02:00Z',
          cacheAgeSeconds: 12,
          fallbackActive: false,
          fallbackReason: null,
          methodologySummary: 'Independent scales.',
        },
      },
      overview: {
        headline: 'Low-Emission Daily Routines',
        summary: 'Summary',
        totalRecommended: 2,
        totalOptional: 1,
        totalUnavailable: 0,
        exposureCount: 2,
        emissionCount: 1,
        bothCount: 0,
        safetyAndScopeNotice: 'Evidence-based guidance only.',
      },
      betterTimeWindows: {
        status: 'available' as const,
        windows: [],
        limitationDisclosure: 'Model derived windows.',
      },
      commuteSummary: {
        savedMode: 'gas_vehicle' as const,
        effectiveMode: 'gas_vehicle' as const,
        headline: 'Commute Strategy',
        exposureVsEmissionsNote: 'Shifting to transit reduces both.',
        options: [],
      },
      periods: [],
    })),
    refreshDailyRoutines: vi.fn(async () => ({
      routineId: 'test-routine-id',
      generatedAt: '2026-11-22T12:00:00Z',
      cachedResult: false,
      location: {
        city: storedProfile?.city ?? 'Krakow',
        neighborhood: storedProfile?.neighborhood ?? 'Krowodrza',
        country: storedProfile?.country ?? 'Poland',
        postalPrefix: '30-01',
        resolvedLabel: 'Krakow, Poland',
        latitude: 50.061,
        longitude: 19.937,
        timezone: 'Europe/Warsaw',
        resolutionSource: 'saved_profile_geocoded' as const,
      },
      profileContext: {
        primaryZoneType: 'valley_basin' as const,
        householdSize: 4,
        householdComposition: [
          'adults',
          'young_children',
        ] as HouseholdLifestyleRecord['householdComposition'],
        savedCommuteMode: 'gas_vehicle' as const,
        effectiveCommuteMode: 'gas_vehicle' as const,
        savedOutdoorPattern: 'school_run_family' as const,
        effectiveOutdoorPattern: 'school_run_family' as const,
        heatingType: 'district' as const,
        ventilationContext: 'natural_windows' as const,
        hasIndoorAirPurifier: true,
        preferredGuidanceFocus: 'balanced' as const,
        isScenarioPreview: false,
      },
      airQualityContext: {
        usAqi: {
          scale: 'us_aqi' as const,
          scaleLabel: 'US AQI (EPA)',
          authorityLabel: 'U.S. EPA 0–500 Scale',
          value: 74,
          status: 'available' as const,
          category: 'Moderate',
          pollutionLevel: 'moderate' as const,
          pollutionLevelLabel: 'Moderate pollution level',
          severityToken: 'moderate' as const,
          meaning: 'Air quality is acceptable.',
          precautionSummary: 'Consider shorter outdoor exercise.',
          methodologyNote: 'US AQI.',
        },
        europeanAqi: {
          scale: 'european_aqi' as const,
          scaleLabel: 'European AQI (EEA)',
          authorityLabel: 'EEA 0–100+ Index',
          value: 48,
          status: 'available' as const,
          category: 'Moderate',
          pollutionLevel: 'moderate' as const,
          pollutionLevelLabel: 'Moderate pollution level',
          severityToken: 'moderate' as const,
          meaning: 'EEA moderate.',
          precautionSummary: 'Quiet routes.',
          methodologyNote: 'EEA bands.',
        },
        dominantPollutant: {
          status: 'available' as const,
          code: 'pm2_5' as const,
          abbreviation: 'PM2.5',
          fullName: 'Fine Particulate Matter',
          basis: 'provider_sub_index' as const,
          estimatedSubIndex: 74,
          explanation: 'Fine PM2.5.',
        },
        pollutants: [],
        transparency: {
          providerId: 'open-meteo' as const,
          providerName: 'Open-Meteo',
          dataNature: 'model_forecast' as const,
          dataNatureDisclosure: 'Model forecast.',
          attribution: 'Open-Meteo CC BY 4.0',
          freshnessStatus: 'fresh' as const,
          availabilityStatus: 'available' as const,
          observationTimestamp: '2026-11-22T12:00:00Z',
          fetchedAt: '2026-11-22T12:02:00Z',
          cacheAgeSeconds: 12,
          fallbackActive: false,
          fallbackReason: null,
          methodologySummary: 'Independent scales.',
        },
      },
      overview: {
        headline: 'Low-Emission Daily Routines',
        summary: 'Summary',
        totalRecommended: 2,
        totalOptional: 1,
        totalUnavailable: 0,
        exposureCount: 2,
        emissionCount: 1,
        bothCount: 0,
        safetyAndScopeNotice: 'Evidence-based guidance only.',
      },
      betterTimeWindows: {
        status: 'available' as const,
        windows: [],
        limitationDisclosure: 'Model derived windows.',
      },
      commuteSummary: {
        savedMode: 'gas_vehicle' as const,
        effectiveMode: 'gas_vehicle' as const,
        headline: 'Commute Strategy',
        exposureVsEmissionsNote: 'Shifting to transit reduces both.',
        options: [],
      },
      periods: [],
    })),
    getIndoorAirGuidance: vi.fn(async (): Promise<IndoorAirGuidanceResponse> => ({
      guidanceId: 'test-indoor-guidance-id',
      generatedAt: '2026-11-22T12:00:00Z',
      cachedResult: false,
      location: {
        city: storedProfile?.city ?? 'Krakow',
        neighborhood: storedProfile?.neighborhood ?? 'Krowodrza',
        country: storedProfile?.country ?? 'Poland',
        postalPrefix: '30-01',
        resolvedLabel: `${storedProfile?.city ?? 'Krakow'}, Poland`,
        latitude: 50.061,
        longitude: 19.937,
        timezone: 'Europe/Warsaw',
        resolutionSource: 'saved_profile_geocoded',
      },
      overview: {
        headline: 'Indoor Air Quality Assistant',
        summary: 'Guidance based on saved household settings and outdoor conditions.',
        householdSize: 4,
        householdComposition: [
          'adults',
          'young_children',
        ] as HouseholdLifestyleRecord['householdComposition'],
        ventilationContext: 'natural_windows',
        hasIndoorAirPurifier: true,
        heatingType: 'district',
        primaryZoneType: 'valley_basin',
        outdoorConditionSummary: 'Moderate outdoor particulate levels.',
        sensorStatus: {
          sensorConnected: false,
          disclosureStatement:
            'Indoor air quality is not being measured. These recommendations are based on your household settings, available outdoor air-quality information and general guidance.',
          evidenceDistinctions: [
            {
              category: 'measured_indoor',
              label: 'Measured indoor air quality',
              statusLabel: 'Not available (no indoor sensors connected)',
              description: 'VAYORA has no connected indoor sensors.',
            },
            {
              category: 'outdoor_air_quality',
              label: 'Outdoor air quality information',
              statusLabel: 'Model forecast available',
              description: 'Open-Meteo outdoor model data.',
            },
            {
              category: 'estimated_inferred_indoor',
              label: 'Estimated or inferred indoor conditions',
              statusLabel: 'Context-inferred only',
              description: 'Inferred from outdoor infiltration and household profile.',
            },
            {
              category: 'general_educational_guidance',
              label: 'General educational guidance',
              statusLabel: 'Evidence-based household practices',
              description: 'Standard source control and filtration practices.',
            },
          ],
        },
      },
      airQualityContext: {
        usAqi: {
          scale: 'us_aqi',
          scaleLabel: 'US AQI (EPA)',
          authorityLabel: 'U.S. EPA 0–500 Scale',
          value: 74,
          status: 'available',
          category: 'Moderate',
          pollutionLevel: 'moderate',
          pollutionLevelLabel: 'Moderate pollution level',
          severityToken: 'moderate',
          meaning: 'Air quality is acceptable.',
          precautionSummary: 'Short airing.',
          methodologyNote: 'US AQI.',
        },
        europeanAqi: {
          scale: 'european_aqi',
          scaleLabel: 'European AQI (EEA)',
          authorityLabel: 'EEA 0–100+ Index',
          value: 48,
          status: 'available',
          category: 'Moderate',
          pollutionLevel: 'moderate',
          pollutionLevelLabel: 'Moderate pollution level',
          severityToken: 'moderate',
          meaning: 'EEA moderate.',
          precautionSummary: 'Quiet routes.',
          methodologyNote: 'EEA bands.',
        },
        dominantPollutant: {
          status: 'available',
          code: 'pm2_5',
          abbreviation: 'PM2.5',
          fullName: 'Fine Particulate Matter',
          basis: 'provider_sub_index',
          estimatedSubIndex: 74,
          explanation: 'Fine PM2.5.',
        },
        pollutants: [],
        transparency: {
          providerId: 'open-meteo',
          providerName: 'Open-Meteo',
          dataNature: 'model_forecast',
          dataNatureDisclosure: 'Model forecast.',
          attribution: 'Open-Meteo CC BY 4.0',
          freshnessStatus: 'fresh',
          availabilityStatus: 'available',
          observationTimestamp: '2026-11-22T12:00:00Z',
          fetchedAt: '2026-11-22T12:02:00Z',
          cacheAgeSeconds: 12,
          fallbackActive: false,
          fallbackReason: null,
          methodologySummary: 'Independent scales.',
        },
      },
      scenarioContext: {
        selectedScenario: 'baseline',
        isSimulation: false,
        simulationLabel: 'Saved household baseline',
        scenarioTitle: 'Saved household baseline',
        scenarioDescription: 'Saved home setup.',
        scenarioFocusNotes: [],
        availableScenarios: [
          {
            id: 'baseline',
            label: 'Saved household baseline',
            shortDescription: 'Baseline.',
          },
        ],
      },
      ventilationGuidance: {
        state: 'shorter_timed_ventilation',
        stateLabel: 'Shorter timed ventilation',
        headline: 'Prefer shorter timed airing',
        summary: 'Open windows briefly away from rush-hour traffic.',
        bestWindowHint: null,
        windowDisclosure: 'No hourly window needed.',
        essentialSafetyReminder: 'Never seal combustion appliances.',
        constraintsAndTradeoffs: ['Outdoor model estimate.'],
        informationCategory: 'estimated_inferred_indoor',
      },
      purifierGuidance: {
        hasPurifier: true,
        scenarioSimulatedPurifier: false,
        headline: 'Run HEPA purifier during moderate outdoor pollution',
        summary: 'Run unit in occupied rooms.',
        practicalGuidance: ['Use continuous low/medium speed.'],
        gasAndVocLimitation: 'HEPA filters do not capture carbon monoxide or most gases.',
        nonPurchaseNote: null,
        informationCategory: 'general_educational_guidance',
      },
      actionPlan: [],
      pollutionSources: [],
      provenanceAndSafety: {
        dataSources: ['Household profile', 'Open-Meteo'],
        nonMedicalNotice: 'Educational guidance only.',
        limitationsSummary: 'No indoor sensors connected.',
      },
    })),
    refreshIndoorAirGuidance: vi.fn(async (): Promise<IndoorAirGuidanceResponse> => ({
      guidanceId: 'test-indoor-guidance-id',
      generatedAt: '2026-11-22T12:00:00Z',
      cachedResult: false,
      location: {
        city: storedProfile?.city ?? 'Krakow',
        neighborhood: storedProfile?.neighborhood ?? 'Krowodrza',
        country: storedProfile?.country ?? 'Poland',
        postalPrefix: '30-01',
        resolvedLabel: `${storedProfile?.city ?? 'Krakow'}, Poland`,
        latitude: 50.061,
        longitude: 19.937,
        timezone: 'Europe/Warsaw',
        resolutionSource: 'saved_profile_geocoded',
      },
      overview: {
        headline: 'Indoor Air Quality Assistant',
        summary: 'Guidance based on saved household settings and outdoor conditions.',
        householdSize: 4,
        householdComposition: [
          'adults',
          'young_children',
        ] as HouseholdLifestyleRecord['householdComposition'],
        ventilationContext: 'natural_windows',
        hasIndoorAirPurifier: true,
        heatingType: 'district',
        primaryZoneType: 'valley_basin',
        outdoorConditionSummary: 'Moderate outdoor particulate levels.',
        sensorStatus: {
          sensorConnected: false,
          disclosureStatement:
            'Indoor air quality is not being measured. These recommendations are based on your household settings, available outdoor air-quality information and general guidance.',
          evidenceDistinctions: [],
        },
      },
      airQualityContext: {
        usAqi: {
          scale: 'us_aqi',
          scaleLabel: 'US AQI (EPA)',
          authorityLabel: 'U.S. EPA 0–500 Scale',
          value: 74,
          status: 'available',
          category: 'Moderate',
          pollutionLevel: 'moderate',
          pollutionLevelLabel: 'Moderate pollution level',
          severityToken: 'moderate',
          meaning: 'Air quality is acceptable.',
          precautionSummary: 'Short airing.',
          methodologyNote: 'US AQI.',
        },
        europeanAqi: {
          scale: 'european_aqi',
          scaleLabel: 'European AQI (EEA)',
          authorityLabel: 'EEA 0–100+ Index',
          value: 48,
          status: 'available',
          category: 'Moderate',
          pollutionLevel: 'moderate',
          pollutionLevelLabel: 'Moderate pollution level',
          severityToken: 'moderate',
          meaning: 'EEA moderate.',
          precautionSummary: 'Quiet routes.',
          methodologyNote: 'EEA bands.',
        },
        dominantPollutant: {
          status: 'available',
          code: 'pm2_5',
          abbreviation: 'PM2.5',
          fullName: 'Fine Particulate Matter',
          basis: 'provider_sub_index',
          estimatedSubIndex: 74,
          explanation: 'Fine PM2.5.',
        },
        pollutants: [],
        transparency: {
          providerId: 'open-meteo',
          providerName: 'Open-Meteo',
          dataNature: 'model_forecast',
          dataNatureDisclosure: 'Model forecast.',
          attribution: 'Open-Meteo CC BY 4.0',
          freshnessStatus: 'fresh',
          availabilityStatus: 'available',
          observationTimestamp: '2026-11-22T12:00:00Z',
          fetchedAt: '2026-11-22T12:02:00Z',
          cacheAgeSeconds: 12,
          fallbackActive: false,
          fallbackReason: null,
          methodologySummary: 'Independent scales.',
        },
      },
      scenarioContext: {
        selectedScenario: 'baseline',
        isSimulation: false,
        simulationLabel: 'Saved household baseline',
        scenarioTitle: 'Saved household baseline',
        scenarioDescription: 'Saved home setup.',
        scenarioFocusNotes: [],
        availableScenarios: [],
      },
      ventilationGuidance: {
        state: 'shorter_timed_ventilation',
        stateLabel: 'Shorter timed ventilation',
        headline: 'Prefer shorter timed airing',
        summary: 'Open windows briefly away from rush-hour traffic.',
        bestWindowHint: null,
        windowDisclosure: 'No hourly window needed.',
        essentialSafetyReminder: 'Never seal combustion appliances.',
        constraintsAndTradeoffs: ['Outdoor model estimate.'],
        informationCategory: 'estimated_inferred_indoor',
      },
      purifierGuidance: {
        hasPurifier: true,
        scenarioSimulatedPurifier: false,
        headline: 'Run HEPA purifier during moderate outdoor pollution',
        summary: 'Run unit in occupied rooms.',
        practicalGuidance: ['Use continuous low/medium speed.'],
        gasAndVocLimitation: 'HEPA filters do not capture carbon monoxide or most gases.',
        nonPurchaseNote: null,
        informationCategory: 'general_educational_guidance',
      },
      actionPlan: [],
      pollutionSources: [],
      provenanceAndSafety: {
        dataSources: ['Household profile', 'Open-Meteo'],
        nonMedicalNotice: 'Educational guidance only.',
        limitationsSummary: 'No indoor sensors connected.',
      },
    })),
    getSustainableAlternatives: vi.fn(async (): Promise<SustainableAlternativesResponse> => ({
      advisoryId: 'test-alt-id',
      generatedAt: '2026-11-23T09:00:00Z',
      cachedResult: false,
      location: {
        city: storedProfile?.city ?? 'Krakow',
        neighborhood: storedProfile?.neighborhood ?? 'Krowodrza',
        country: storedProfile?.country ?? 'Poland',
        postalPrefix: '30-01',
        resolvedLabel: `${storedProfile?.city ?? 'Krakow'}, Poland`,
        latitude: 50.061,
        longitude: 19.937,
        timezone: 'Europe/Warsaw',
        resolutionSource: 'saved_profile_geocoded',
      },
      overview: {
        headline: 'Sustainable Alternatives Advisor',
        summary: 'Tailored household alternatives.',
        totalCatalogEvaluated: 0,
        matchedAlternativesCount: 0,
        countsByCategory: {
          transportation: 0,
          household_energy_heating: 0,
          everyday_activities: 0,
          consumption_waste: 0,
        },
        countsByImpact: {
          local_emissions: 0,
          personal_exposure: 0,
          both_exposure_and_emissions: 0,
          broader_sustainability: 0,
        },
        householdSummary: {
          householdSize: 4,
          householdComposition: [
            'adults',
            'young_children',
          ] as HouseholdLifestyleRecord['householdComposition'],
          primaryCommuteMode: 'public_transit',
          heatingType: 'district',
          ventilationContext: 'natural_windows',
          primaryZoneType: 'valley_basin',
        },
        outdoorConditionSummary: 'Moderate.',
        impactDistinctionLegend: [],
        activeTransportAqiNote: 'Condition-checked.',
      },
      appliedFilters: {
        category: null,
        affordability: null,
        relevance: null,
        impactType: null,
        practicality: null,
      },
      airQualityContext: {
        usAqi: {
          scale: 'us_aqi',
          scaleLabel: 'US AQI (EPA)',
          authorityLabel: 'U.S. EPA',
          value: 45,
          status: 'available',
          category: 'Good',
          pollutionLevel: 'low',
          pollutionLevelLabel: 'Low pollution level',
          severityToken: 'good',
          meaning: 'Good.',
          precautionSummary: 'Normal.',
          methodologyNote: 'US EPA.',
        },
        europeanAqi: {
          scale: 'european_aqi',
          scaleLabel: 'European AQI (EEA)',
          authorityLabel: 'EEA',
          value: 20,
          status: 'available',
          category: 'Good',
          pollutionLevel: 'low',
          pollutionLevelLabel: 'Low pollution level',
          severityToken: 'good',
          meaning: 'Good.',
          precautionSummary: 'Normal.',
          methodologyNote: 'EEA.',
        },
        dominantPollutant: {
          status: 'available',
          code: 'pm2_5',
          abbreviation: 'PM2.5',
          fullName: 'Fine Particulate Matter',
          basis: 'provider_sub_index',
          estimatedSubIndex: 45,
          explanation: 'Low.',
        },
        transparency: {
          providerId: 'open-meteo',
          providerName: 'Open-Meteo',
          dataNature: 'model_forecast',
          dataNatureDisclosure: 'Model forecast.',
          attribution: 'Open-Meteo CC BY 4.0',
          freshnessStatus: 'fresh',
          availabilityStatus: 'available',
          observationTimestamp: '2026-11-23T09:00:00Z',
          fetchedAt: '2026-11-23T09:01:00Z',
          cacheAgeSeconds: 10,
          fallbackActive: false,
          fallbackReason: null,
          methodologySummary: 'Independent scales.',
        },
      },
      alternatives: [],
      featuredComparison: null,
      provenanceAndDisclosures: {
        dataSources: ['Household profile', 'Open-Meteo'],
        methodologicalPrinciples: ['Qualitative only.'],
        limitationsSummary: 'Conditional on local infrastructure.',
      },
    })),
    compareSustainableAlternative: vi.fn(async (): Promise<AlternativeComparisonView> => ({
      alternativeId: 'consumption-reuse-repair-packaging',
      alternativeTitle: 'Reuse & repair',
      category: 'consumption_waste',
      impactClassification: 'broader_sustainability',
      impactClassificationLabel: 'Broader sustainability benefit',
      affordabilityTier: 'zero_cost',
      affordabilityLabel: 'No added cost',
      relevanceScope: 'both',
      suitabilityStatus: 'recommended',
      selectedBaselineId: 'disposable_replace_first',
      selectedBaselineLabel: 'Disposable',
      availableBaselines: [],
      currentChoiceSummary: 'Disposable.',
      suggestedAlternativeSummary: 'Reusable.',
      whyPreferable: 'Cuts waste.',
      directAirQualityAndEmissionsEffect: 'Broader benefit.',
      personalExposureEffect: 'Neutral.',
      broaderSustainabilityEffect: 'Cuts waste.',
      ghgVsLocalPollutantDistinction: 'Distinct.',
      costAndAccessibility: 'Zero cost.',
      tradeoffsAndLimitations: 'Repair access varies.',
      infrastructureConditionality: null,
      evidenceReference: {
        sourceName: 'US EPA SMM',
        sourceUrl: 'https://www.epa.gov/smm',
        relevantFinding: 'Reduces waste.',
        versionOrDate: '2024',
        limitations: 'Not local AQI.',
      },
    })),
    refreshSustainableAlternatives: vi.fn(),
    getPersonalizedBriefing: vi.fn(async () => ({
      briefingId: 'test-briefing-id',
      location: {
        city: storedProfile?.city ?? 'Krakow',
        neighborhood: storedProfile?.neighborhood ?? 'Krowodrza',
        country: storedProfile?.country ?? 'Poland',
        postalPrefix: '30-01',
        resolvedLabel: `${storedProfile?.city ?? 'Krakow'}, Poland`,
        latitude: 50.061,
        longitude: 19.937,
        timezone: 'Europe/Warsaw',
        resolutionSource: 'saved_profile_geocoded' as const,
      },
      householdSummary: {
        city: storedProfile?.city ?? 'Krakow',
        neighborhood: storedProfile?.neighborhood ?? 'Krowodrza',
        primaryZoneType: 'valley_basin' as const,
        householdSize: 4,
        householdComposition: [
          'adults',
          'young_children',
        ] as HouseholdLifestyleRecord['householdComposition'],
        primaryCommuteMode: 'gas_vehicle' as const,
        outdoorActivityPattern: 'school_run_family' as const,
        ventilationContext: 'natural_windows' as const,
        hasIndoorAirPurifier: true,
        heatingType: 'district' as const,
        preferredGuidanceFocus: 'balanced' as const,
      },
      airQualitySnapshot: {
        freshnessStatus: 'fresh' as const,
        availabilityStatus: 'available' as const,
        observationTimestamp: '2026-11-23T09:00:00Z',
        usAqiValue: 74,
        usAqiCategory: 'Moderate',
        europeanAqiValue: 48,
        europeanAqiCategory: 'Moderate',
        dominantPollutantCode: 'pm2_5',
        dominantPollutantLabel: 'PM2.5',
        isHighOrWorse: false,
        isElevatedOrWorse: false,
        isCyclingNotAdvised: false,
        bestForecastWindowLabel: null,
        aqSummary: 'Moderate particulate levels.',
        activeScaleNote: 'dual_epa_eea' as const,
      },
      headline: 'Balanced household briefing',
      summary: 'Follow standard routines and brief airing away from rush-hour traffic.',
      outdoorInfluenceSummary: 'US AQI 74 (Moderate).',
      indoorContextSummary: 'No indoor sensors connected.',
      priorityActions: [],
      cautionsAndLimitations: 'Educational guidance only.',
      verifiedEvidence: [],
      availableRecommendations: [],
      generationMeta: {
        generationMode: 'gemini' as const,
        model: 'gemini-4-hydrogen',
        fallbackReason: null,
        aiDisclosure: 'AI-generated explanation grounded in VAYORA deterministic rules.',
        nonMedicalNotice: 'Educational guidance only.',
        freshnessDisclosure: 'fresh' as const,
        freshnessMessage: 'Fresh Open-Meteo model data.',
        contextFingerprint: 'test-fp',
        cachedResult: false,
        generatedAt: '2026-11-23T09:00:00Z',
        latencyMs: 50,
        focus: 'balanced' as const,
      },
    })),
    explainRecommendation: vi.fn(),
    compareChoicesExplanation: vi.fn(),
    refreshPersonalizedAdvisory: vi.fn(),
    getAdvisoryMetrics: vi.fn(),
  };

  return { authService, householdStore, apiClient };
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('Phase 1 Authentication & Household Onboarding Flows', () => {
  it('supports registration validation, duplicate handling, email verification gate, and 3-step onboarding completion', async () => {
    const harness = createHarness();
    const { container } = render(
      <App
        authService={harness.authService}
        householdStore={harness.householdStore}
        apiClient={harness.apiClient}
      />,
    );

    fireEvent.click(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Create account' }),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /Create your household account/i }),
    ).toBeInTheDocument();
    await runAxeAudit(container);

    // Duplicate email handling
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Elena Nowak' } });
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'duplicate@household.org' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/, { selector: 'input' }), {
      target: { value: 'WinterCleanAir2026!' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm password/, { selector: 'input' }), {
      target: { value: 'WinterCleanAir2026!' },
    });
    fireEvent.click(screen.getByLabelText(/Terms of Use/));
    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', { name: 'Create account' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);

    // Successful registration -> Verify Email screen
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'elena@household.org' },
    });
    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', { name: 'Create account' }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: /Verify your email address/i }),
    ).toBeInTheDocument();
    await runAxeAudit(container);

    // Confirm email verification through server session check -> Household Onboarding Step 1
    fireEvent.click(screen.getByRole('button', { name: /I've verified my email/i }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Set up your household air-quality profile/i,
      }),
    ).toBeInTheDocument();
    expect(harness.apiClient.getAuthSession).toHaveBeenCalled();
    expect(harness.householdStore.syncVerifiedUserAccount).toHaveBeenCalled();
    await runAxeAudit(container);

    // Step 1: Location
    fireEvent.change(screen.getByLabelText(/Country/), { target: { value: 'Poland' } });
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Krakow' } });
    fireEvent.change(screen.getByLabelText(/Neighborhood or district/), {
      target: { value: 'Krowodrza' },
    });
    fireEvent.change(screen.getByLabelText(/Postal prefix/), { target: { value: '30-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Step 2' }));

    // Step 2: Household & Routine
    expect(
      await screen.findByRole('heading', { level: 2, name: /Household & Daily Routine/i }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Household size/), { target: { value: '4' } });
    fireEvent.click(screen.getByLabelText(/Young children/));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Step 3' }));

    // Step 3: Indoor Air & Preferences -> Complete Onboarding
    expect(
      await screen.findByRole('heading', { level: 2, name: /Indoor Air & Guidance Preferences/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/HEPA indoor air purifier/));
    fireEvent.click(screen.getByRole('button', { name: 'Complete onboarding' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: /Air Quality Overview/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Welcome, Elena Nowak/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Krowodrza, Krakow, Poland/).length).toBeGreaterThan(0);
    await runAxeAudit(container);

    // Navigate to My Household and edit preferences after completion
    fireEvent.click(screen.getByTestId('sidebar-nav-household'));
    expect(
      await screen.findByRole('heading', { level: 1, name: /My Household/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Edit preferences/i }));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Edit household location & lifestyle preferences/i,
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Warsaw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Step 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Step 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save updated preferences' }));

    expect((await screen.findAllByText(/Krowodrza, Warsaw, Poland/)).length).toBeGreaterThan(0);
  });

  it('provides enumeration-resistant forgot password response and handles expired vs valid reset links', async () => {
    const harness = createHarness();
    const { container } = render(
      <App
        authService={harness.authService}
        householdStore={harness.householdStore}
        apiClient={harness.apiClient}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(
      screen.getByRole('heading', { level: 1, name: /Reset your password/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'unknown@household.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset instructions' }));

    const confirmation = await screen.findByRole('status');
    expect(confirmation).toHaveTextContent(
      'If an account exists for that email address, password reset instructions have been sent.',
    );
    await runAxeAudit(container);
  });

  it('recovers cleanly from expired reset oobCode and accepts valid password reset confirmation', async () => {
    window.history.replaceState({}, '', '/?mode=resetPassword&oobCode=expired-code-999');
    const expiredHarness = createHarness();
    render(
      <App
        authService={expiredHarness.authService}
        householdStore={expiredHarness.householdStore}
        apiClient={expiredHarness.apiClient}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/expired/i);
    expect(screen.getByRole('button', { name: 'Request a new reset link' })).toBeInTheDocument();

    cleanup();
    window.history.replaceState({}, '', '/?mode=resetPassword&oobCode=valid-reset-code-123');
    const validHarness = createHarness();
    render(
      <App
        authService={validHarness.authService}
        householdStore={validHarness.householdStore}
        apiClient={validHarness.apiClient}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/^New password/, { selector: 'input' })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/^New password/), {
      target: { value: 'UpdatedAirPass2026!' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm new password/, { selector: 'input' }), {
      target: { value: 'UpdatedAirPass2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Sign in to Urban Air Quality Assistant/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/password has been updated/i);
  });

  it('handles login errors, protected route URL attempts, and logout cleanly', async () => {
    window.history.replaceState({}, '', '/?view=onboarding');
    const harness = createHarness();
    render(
      <App
        authService={harness.authService}
        householdStore={harness.householdStore}
        apiClient={harness.apiClient}
      />,
    );

    // Protected route attempt redirects to login with notice
    expect(
      screen.getByRole('heading', { level: 1, name: /Sign in to Urban Air Quality Assistant/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /Sign in with a verified household account/i,
    );

    // Invalid login
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'elena@household.org' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/, { selector: 'input' }), {
      target: { value: 'WrongPassword1!' },
    });
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Invalid email address or password/i,
    );

    // Valid login + Save Draft + Resume later
    fireEvent.change(screen.getByLabelText(/^Password/, { selector: 'input' }), {
      target: { value: 'WinterCleanAir2026!' },
    });
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Set up your household air-quality profile/i,
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Country/), { target: { value: 'Poland' } });
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Gdansk' } });
    fireEvent.change(screen.getByLabelText(/Neighborhood or district/), {
      target: { value: 'Wrzeszcz' },
    });
    fireEvent.change(screen.getByLabelText(/Postal prefix/), { target: { value: '80-2' } });
    fireEvent.click(screen.getByRole('button', { name: /Save draft & resume later/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/draft has been saved/i);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Sign in to Urban Air Quality Assistant/i,
      }),
    ).toBeInTheDocument();

    // Sign back in -> resumes onboarding wizard with previously saved draft city prefilled
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'elena@household.org' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/, { selector: 'input' }), {
      target: { value: 'WinterCleanAir2026!' },
    });
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Set up your household air-quality profile/i,
      }),
    ).toBeInTheDocument();
    expect((screen.getByLabelText(/City/) as HTMLInputElement).value).toBe('Gdansk');
  });
});
