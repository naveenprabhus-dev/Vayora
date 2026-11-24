import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function buildApiEnvelope<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      requestId: 'e2e-req-1',
      timestamp: '2026-11-22T12:00:00.000Z',
    },
  };
}

function createDashboardPayload(options?: {
  readonly city?: string;
  readonly neighborhood?: string;
  readonly freshness?: 'fresh' | 'stale' | 'unavailable';
}) {
  const city = options?.city ?? 'Krakow';
  const neighborhood = options?.neighborhood ?? 'Krowodrza';
  const freshness = options?.freshness ?? 'fresh';
  const isUnavailable = freshness === 'unavailable';

  return {
    location: {
      city,
      neighborhood,
      country: 'Poland',
      postalPrefix: city === 'Warsaw' ? '02-5' : '30-01',
      resolvedLabel: `${city}, Poland`,
      latitude: city === 'Warsaw' ? 52.23 : 50.061,
      longitude: city === 'Warsaw' ? 21.012 : 19.937,
      timezone: 'Europe/Warsaw',
      resolutionSource: 'saved_profile_geocoded',
    },
    aqi: {
      usAqi: {
        scale: 'us_aqi',
        scaleLabel: 'US AQI (EPA)',
        authorityLabel: 'U.S. EPA 0–500 Scale (40 CFR Part 58 Appendix G)',
        value: isUnavailable ? null : city === 'Warsaw' ? 62 : 118,
        status: isUnavailable ? 'unavailable' : 'available',
        category: isUnavailable
          ? 'Unavailable'
          : city === 'Warsaw'
            ? 'Moderate'
            : 'Unhealthy for Sensitive Groups',
        pollutionLevel: isUnavailable ? 'unavailable' : 'moderate',
        pollutionLevelLabel: isUnavailable
          ? 'Unavailable'
          : city === 'Warsaw'
            ? 'Moderate pollution level'
            : 'Moderate–elevated pollution level',
        severityToken: isUnavailable ? 'unavailable' : city === 'Warsaw' ? 'moderate' : 'elevated',
        meaning: isUnavailable
          ? 'Live US AQI could not be retrieved.'
          : 'Fine particulate buildup in urban valley basins.',
        precautionSummary: isUnavailable
          ? 'Follow general clean-air habits until telemetry resumes.'
          : 'Run indoor HEPA filtration and limit heavy roadside exertion.',
        methodologyNote: 'US AQI reports the highest individual pollutant sub-index.',
      },
      europeanAqi: {
        scale: 'european_aqi',
        scaleLabel: 'European AQI (EEA)',
        authorityLabel: 'European Environment Agency (EEA) 0–100+ Index',
        value: isUnavailable ? null : city === 'Warsaw' ? 38 : 69,
        status: isUnavailable ? 'unavailable' : 'available',
        category: isUnavailable ? 'Unavailable' : city === 'Warsaw' ? 'Fair' : 'Poor',
        pollutionLevel: isUnavailable ? 'unavailable' : city === 'Warsaw' ? 'low' : 'high',
        pollutionLevelLabel: isUnavailable
          ? 'Unavailable'
          : city === 'Warsaw'
            ? 'Low–fair pollution level'
            : 'High pollution level',
        severityToken: isUnavailable ? 'unavailable' : city === 'Warsaw' ? 'good' : 'high',
        meaning: isUnavailable
          ? 'Live European AQI could not be retrieved.'
          : 'Elevated particulate concentration against EEA bands.',
        precautionSummary: 'Prefer low-traffic walking routes and timed airing.',
        methodologyNote: 'EEA assigns bands from 0 to 100+ based on worst pollutant.',
      },
      dominantPollutant: isUnavailable
        ? {
            status: 'unavailable',
            code: null,
            abbreviation: null,
            fullName: null,
            basis: 'unavailable',
            estimatedSubIndex: null,
            explanation: 'Insufficient pollutant readings available.',
          }
        : {
            status: 'available',
            code: 'pm2_5',
            abbreviation: 'PM2.5',
            fullName: 'Fine Particulate Matter',
            basis: 'provider_sub_index',
            estimatedSubIndex: city === 'Warsaw' ? 62 : 118,
            explanation: 'Fine Particulate Matter (PM2.5) contributes the highest index share.',
          },
    },
    pollutants: [
      {
        code: 'pm2_5',
        fullName: 'Fine Particulate Matter',
        abbreviation: 'PM2.5',
        concentration: isUnavailable ? null : city === 'Warsaw' ? 17.5 : 42.3,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable ? 'unavailable' : 'elevated',
        concentrationBandLabel: isUnavailable ? 'Unavailable' : 'Elevated concentration',
        explanation: 'Fine particles under 2.5 micrometers from heating and traffic.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
      {
        code: 'pm10',
        fullName: 'Coarse Particulate Matter',
        abbreviation: 'PM10',
        concentration: isUnavailable ? null : 58.1,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable ? 'unavailable' : 'moderate',
        concentrationBandLabel: isUnavailable ? 'Unavailable' : 'Moderate concentration',
        explanation: 'Coarse dust and aerosols.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
      {
        code: 'no2',
        fullName: 'Nitrogen Dioxide',
        abbreviation: 'NO2',
        concentration: isUnavailable ? null : 39.0,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable ? 'unavailable' : 'low',
        concentrationBandLabel: isUnavailable ? 'Unavailable' : 'Low concentration',
        explanation: 'Roadway fuel combustion gas.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
      {
        code: 'so2',
        fullName: 'Sulfur Dioxide',
        abbreviation: 'SO2',
        concentration: null,
        unit: 'µg/m³',
        status: 'unavailable',
        concentrationBand: 'unavailable',
        concentrationBandLabel: 'Unavailable',
        explanation: 'Sulfur-containing fuel gas.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
      {
        code: 'co',
        fullName: 'Carbon Monoxide',
        abbreviation: 'CO',
        concentration: isUnavailable ? null : 510,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable ? 'unavailable' : 'low',
        concentrationBandLabel: isUnavailable ? 'Unavailable' : 'Low concentration',
        explanation: 'Incomplete combustion gas.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
      {
        code: 'o3',
        fullName: 'Ground-Level Ozone',
        abbreviation: 'O3',
        concentration: isUnavailable ? null : 36.5,
        unit: 'µg/m³',
        status: isUnavailable ? 'unavailable' : 'available',
        concentrationBand: isUnavailable ? 'unavailable' : 'low',
        concentrationBandLabel: isUnavailable ? 'Unavailable' : 'Low concentration',
        explanation: 'Surface photochemical oxidant.',
        distinctionNote: 'Mass concentration in µg/m³.',
      },
    ],
    forecastPreview: isUnavailable
      ? []
      : Array.from({ length: 24 }, (_, idx) => ({
          timestamp: `2026-11-22T${String(idx).padStart(2, '0')}:00:00Z`,
          usAqi: idx === 4 ? null : 90 + (idx % 12),
          europeanAqi: 54 + (idx % 10),
          pm25: 32 + (idx % 8),
          pm10: 46 + (idx % 10),
          no2: 34,
          so2: null,
          co: 480,
          o3: 38,
          availability: idx === 4 ? 'partial' : 'available',
        })),
    guidance: {
      status: isUnavailable
        ? 'general_precaution'
        : freshness === 'stale'
          ? 'stale_evidence'
          : 'measured_evidence',
      headline: isUnavailable
        ? 'General Clean-Air Precautions (Live Readings Unavailable)'
        : `Moderate–Elevated Pollution Precautions (${city})`,
      summary: isUnavailable
        ? 'Live telemetry could not be verified. Follow general clean-air habits.'
        : 'Proportionate indoor filtration and lower-traffic route timing recommended.',
      fogDistinctionNote:
        'Cold air or ordinary water-vapor fog alone does not mean winter smog is high.',
      guidanceScopeNote: 'General evidence-based guidance; AI personalization arrives in Phase 4.',
      actions: [
        {
          id: 'e2e-action-1',
          category: 'ventilation',
          title: 'Use HEPA filtration during calm inversion hours',
          recommendation: 'Keep street-facing windows closed during evening commute peaks.',
          evidenceBasis: 'Household purifier profile + current PM2.5 telemetry.',
        },
      ],
    },
    transparency: {
      providerId: 'open-meteo',
      providerName: 'Open-Meteo Air Quality & Geocoding API',
      dataNature: isUnavailable ? 'unavailable' : 'model_forecast',
      dataNatureDisclosure: isUnavailable
        ? 'Live air quality telemetry is currently unavailable from the upstream provider.'
        : 'Model-generated atmospheric chemistry estimate and hourly forecast from Open-Meteo (not direct ground-station sensor measurements).',
      attribution: 'Data provided by Open-Meteo.com (CC BY 4.0)',
      freshnessStatus: freshness,
      availabilityStatus: isUnavailable ? 'unavailable' : 'partial',
      observationTimestamp: isUnavailable ? null : '2026-11-22T12:00:00Z',
      fetchedAt: '2026-11-22T12:02:00Z',
      cacheAgeSeconds: freshness === 'stale' ? 2400 : 12,
      fallbackActive: freshness !== 'fresh',
      fallbackReason:
        freshness === 'stale'
          ? 'Displaying cached readings because live retrieval timed out.'
          : freshness === 'unavailable'
            ? 'Upstream air quality service unreachable.'
            : null,
      methodologySummary:
        'US AQI uses US EPA 0–500 breakpoints; European AQI uses EEA 0–100+ bands.',
    },
  };
}

async function setupHarnessApiRoutes(
  page: Page,
  options?: {
    readonly freshness?: 'fresh' | 'stale' | 'unavailable';
  },
) {
  let activeCity = 'Krakow';
  let activeNeighborhood = 'Krowodrza';
  const freshness = options?.freshness ?? 'fresh';

  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          authenticated: true,
          principal: {
            uid: 'uid_e2e_family',
            email: 'elena@household.org',
            emailVerified: true,
            role: 'regular_user',
            authTimeSeconds: 1700000000,
          },
        }),
      ),
    });
  });

  await page.route('**/api/v1/household/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          profile: {
            ownerUid: 'uid_e2e_family',
            country: 'Poland',
            city: activeCity,
            neighborhood: activeNeighborhood,
            postalPrefix: activeCity === 'Warsaw' ? '02-5' : '30-01',
            locationPreferences: { primaryZoneType: 'valley_basin', alertsEnabled: true },
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
          },
        }),
      ),
    });
  });

  await page.route('**/api/v1/air-quality/current*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope(
          createDashboardPayload({
            city: activeCity,
            neighborhood: activeNeighborhood,
            freshness,
          }),
        ),
      ),
    });
  });

  await page.route('**/api/v1/air-quality/forecast*', async (route) => {
    const url = new URL(route.request().url());
    const hours = Number(url.searchParams.get('hours') ?? '24');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          location: createDashboardPayload({ city: activeCity, neighborhood: activeNeighborhood })
            .location,
          horizonHours: hours,
          dataNature: 'model_forecast',
          units: { usAqi: 'US AQI', europeanAqi: 'EAQI', pollutants: 'µg/m³' },
          hourly: Array.from({ length: hours }, (_, idx) => ({
            timestamp: `2026-11-${idx < 24 ? '22' : '23'}T${String(idx % 24).padStart(2, '0')}:00:00Z`,
            usAqi: 85 + (idx % 15),
            europeanAqi: 52 + (idx % 10),
            pm25: 30 + (idx % 8),
            pm10: 44 + (idx % 10),
            no2: 32,
            so2: null,
            co: 470,
            o3: 39,
            availability: 'partial',
          })),
          transparency: createDashboardPayload().transparency,
        }),
      ),
    });
  });

  await page.route('**/api/v1/air-quality/location', async (route) => {
    const body = route.request().postDataJSON() as {
      city: string;
      neighborhood: string;
      country: string;
      postalPrefix: string;
    };
    activeCity = body.city;
    activeNeighborhood = body.neighborhood;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          location: createDashboardPayload({ city: activeCity, neighborhood: activeNeighborhood })
            .location,
          updatedAt: '2026-11-22T12:10:00.000Z',
        }),
      ),
    });
  });

  await page.route('**/api/v1/routines/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          routineId: 'e2e-routine-id',
          generatedAt: '2026-11-22T12:00:00Z',
          cachedResult: false,
          location: createDashboardPayload({ city: activeCity, neighborhood: activeNeighborhood })
            .location,
          profileContext: {
            primaryZoneType: 'valley_basin',
            householdSize: 4,
            householdComposition: ['adults', 'young_children'],
            savedCommuteMode: 'public_transit',
            effectiveCommuteMode: 'public_transit',
            savedOutdoorPattern: 'school_run_family',
            effectiveOutdoorPattern: 'school_run_family',
            heatingType: 'district',
            ventilationContext: 'filtered_hvac_merv13',
            hasIndoorAirPurifier: true,
            preferredGuidanceFocus: 'indoor_air',
            isScenarioPreview: false,
          },
          airQualityContext: {
            usAqi: createDashboardPayload({ city: activeCity, neighborhood: activeNeighborhood })
              .aqi.usAqi,
            europeanAqi: createDashboardPayload({
              city: activeCity,
              neighborhood: activeNeighborhood,
            }).aqi.europeanAqi,
            dominantPollutant: createDashboardPayload({
              city: activeCity,
              neighborhood: activeNeighborhood,
            }).aqi.dominantPollutant,
            pollutants: createDashboardPayload({
              city: activeCity,
              neighborhood: activeNeighborhood,
            }).pollutants,
            transparency: createDashboardPayload({
              city: activeCity,
              neighborhood: activeNeighborhood,
            }).transparency,
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
            status: 'available',
            windows: [],
            limitationDisclosure: 'Model derived windows.',
          },
          commuteSummary: {
            savedMode: 'public_transit',
            effectiveMode: 'public_transit',
            headline: 'Commute Strategy',
            exposureVsEmissionsNote: 'Shifting to transit reduces both.',
            options: [],
          },
          periods: [],
        }),
      ),
    });
  });

  await page.route('**/api/v1/indoor-air/**', async (route) => {
    const dash = createDashboardPayload({
      city: activeCity,
      neighborhood: activeNeighborhood,
      freshness,
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          guidanceId: 'e2e-indoor-stub-id',
          generatedAt: '2026-11-22T12:00:00Z',
          cachedResult: false,
          location: dash.location,
          overview: {
            headline: `Indoor Air Quality Assistant (${activeCity})`,
            summary: 'Tailored indoor air quality guidance based on household settings.',
            householdSize: 4,
            householdComposition: ['adults', 'young_children'],
            ventilationContext: 'filtered_hvac_merv13',
            hasIndoorAirPurifier: true,
            heatingType: 'district',
            primaryZoneType: 'valley_basin',
            outdoorConditionSummary: 'Outdoor telemetry summary.',
            sensorStatus: {
              sensorConnected: false,
              disclosureStatement:
                'Indoor air quality is not being measured. These recommendations are based on your household settings, available outdoor air-quality information and general guidance.',
              evidenceDistinctions: [
                {
                  category: 'measured_indoor',
                  label: 'Measured indoor air quality',
                  statusLabel: 'Not available (no indoor sensors connected)',
                  description: 'No indoor sensors connected.',
                },
                {
                  category: 'outdoor_air_quality',
                  label: 'Outdoor air quality information',
                  statusLabel: freshness === 'unavailable' ? 'Unavailable' : 'Model forecast',
                  description: 'Open-Meteo outdoor air model.',
                },
                {
                  category: 'estimated_inferred_indoor',
                  label: 'Estimated or inferred indoor conditions',
                  statusLabel: 'Inferred context',
                  description: 'Inferred from saved setup.',
                },
                {
                  category: 'general_educational_guidance',
                  label: 'General educational guidance',
                  statusLabel: 'General clean-air steps',
                  description: 'Source control guidance.',
                },
              ],
            },
          },
          airQualityContext: {
            usAqi: dash.aqi.usAqi,
            europeanAqi: dash.aqi.europeanAqi,
            dominantPollutant: dash.aqi.dominantPollutant,
            pollutants: dash.pollutants,
            transparency: dash.transparency,
          },
          scenarioContext: {
            selectedScenario: 'baseline',
            isSimulation: false,
            simulationLabel: 'Saved household baseline',
            scenarioTitle: 'Saved household baseline',
            scenarioDescription: 'Saved home setup.',
            scenarioFocusNotes: [],
            availableScenarios: [
              { id: 'baseline', label: 'Saved household baseline', shortDescription: 'Baseline.' },
            ],
          },
          ventilationGuidance: {
            state: freshness === 'unavailable' ? 'insufficient_data' : 'delay_optional_ventilation',
            stateLabel:
              freshness === 'unavailable'
                ? 'Insufficient outdoor data'
                : 'Delay optional window airing',
            headline: 'Ventilation Guidance',
            summary: 'Use indoor filtered airflow when outdoor particulates are elevated.',
            bestWindowHint: null,
            windowDisclosure: 'Model forecast timing window.',
            essentialSafetyReminder: 'Never seal combustion vents or smoke alarms.',
            constraintsAndTradeoffs: ['Outdoor model estimate only.'],
            informationCategory: 'estimated_inferred_indoor',
          },
          purifierGuidance: {
            hasPurifier: true,
            scenarioSimulatedPurifier: false,
            headline: 'Portable HEPA Purifier Guidance',
            summary: 'Run unit continuously in occupied spaces.',
            practicalGuidance: ['Keep doors closed in active bedroom/living area.'],
            gasAndVocLimitation: 'HEPA filters do not capture carbon monoxide or most gases.',
            nonPurchaseNote: null,
            informationCategory: 'general_educational_guidance',
          },
          actionPlan: [],
          pollutionSources: [],
          provenanceAndSafety: {
            dataSources: ['Household profile', 'Open-Meteo'],
            nonMedicalNotice: 'General educational guidance only.',
            limitationsSummary: 'No indoor sensors.',
          },
        }),
      ),
    });
  });

  await page.route('**/api/v1/alternatives/**', async (route) => {
    const dash = createDashboardPayload({
      city: activeCity,
      neighborhood: activeNeighborhood,
      freshness,
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          advisoryId: 'e2e-alt-stub-id',
          generatedAt: '2026-11-23T09:00:00Z',
          cachedResult: false,
          location: dash.location,
          overview: {
            headline: `Sustainable Alternatives Advisor (${activeCity})`,
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
              householdComposition: ['adults', 'young_children'],
              primaryCommuteMode: 'public_transit',
              heatingType: 'district',
              ventilationContext: 'filtered_hvac_merv13',
              primaryZoneType: 'valley_basin',
            },
            outdoorConditionSummary: 'Outdoor telemetry summary.',
            impactDistinctionLegend: [],
            activeTransportAqiNote: 'Condition-aware active travel guidance.',
          },
          appliedFilters: {
            category: null,
            affordability: null,
            relevance: null,
            impactType: null,
            practicality: null,
          },
          airQualityContext: {
            usAqi: dash.aqi.usAqi,
            europeanAqi: dash.aqi.europeanAqi,
            dominantPollutant: dash.aqi.dominantPollutant,
            transparency: dash.transparency,
          },
          alternatives: [],
          featuredComparison: null,
          provenanceAndDisclosures: {
            dataSources: ['Household profile', 'Open-Meteo'],
            methodologicalPrinciples: ['Qualitative only.'],
            limitationsSummary: 'Conditional on local infrastructure.',
          },
        }),
      ),
    });
  });

  await page.route('**/api/v1/advisory/**', async (route) => {
    const dash = createDashboardPayload({
      city: activeCity,
      neighborhood: activeNeighborhood,
      freshness,
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildApiEnvelope({
          briefingId: 'e2e-briefing-stub',
          location: dash.location,
          householdSummary: {
            city: activeCity,
            neighborhood: activeNeighborhood,
            primaryZoneType: 'valley_basin',
            householdSize: 4,
            householdComposition: ['adults', 'young_children'],
            primaryCommuteMode: 'public_transit',
            outdoorActivityPattern: 'school_run_family',
            ventilationContext: 'filtered_hvac_merv13',
            hasIndoorAirPurifier: true,
            heatingType: 'district',
            preferredGuidanceFocus: 'balanced',
          },
          airQualitySnapshot: {
            freshnessStatus: 'fresh',
            availabilityStatus: 'available',
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
            aqSummary: 'Advisory summary.',
            activeScaleNote: 'dual_epa_eea',
          },
          headline: `Daily briefing (${activeCity})`,
          summary: 'Grounded summary.',
          outdoorInfluenceSummary: 'Outdoor note.',
          indoorContextSummary: 'Indoor context note.',
          priorityActions: [],
          cautionsAndLimitations: 'Educational guidance only.',
          verifiedEvidence: [],
          availableRecommendations: [],
          generationMeta: {
            generationMode: 'gemini',
            model: 'gemini-4-hydrogen',
            fallbackReason: null,
            aiDisclosure: 'AI-generated explanation grounded in VAYORA deterministic rules.',
            nonMedicalNotice: 'Educational guidance only.',
            freshnessDisclosure: 'fresh',
            freshnessMessage: 'Fresh model data.',
            contextFingerprint: 'e2e-fp',
            cachedResult: false,
            generatedAt: '2026-11-23T09:00:00Z',
            latencyMs: 30,
            focus: 'balanced',
          },
        }),
      ),
    });
  });
}

test.describe('Phase 2 VAYORA Air Quality Intelligence (E2E & WCAG 2.2 AA)', () => {
  test('enforces unauthenticated protection on dashboard URLs and live air-quality endpoints', async ({
    page,
  }) => {
    const apiCurrent = await page.request.get('/api/v1/air-quality/current');
    expect(apiCurrent.status()).toBe(401);

    const apiLocation = await page.request.put('/api/v1/air-quality/location', {
      data: { country: 'Poland', city: 'Krakow', neighborhood: 'Old Town', postalPrefix: '31-0' },
    });
    expect(apiLocation.status()).toBe(401);

    await page.goto('/?view=dashboard');
    await expect(
      page.getByRole('heading', { level: 1, name: /Sign in to Urban Air Quality Assistant/i }),
    ).toBeVisible();
  });

  test('renders live US & EU AQI scales, 6 pollutants, interactive forecast & table view, location change, and passes WCAG 2.2 AA across desktop & mobile', async ({
    page,
  }) => {
    await setupHarnessApiRoutes(page, { freshness: 'fresh' });
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');

    await expect(page.getByTestId('air-quality-dashboard')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Krowodrza, Krakow, Poland/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/not direct ground-station sensor measurements/i).first(),
    ).toBeVisible();

    // Verify US AQI & European AQI remain separate and switchable
    await expect(page.getByTestId('primary-aqi-value')).toHaveText('118');
    await expect(page.getByTestId('companion-aqi-value')).toHaveText('69');
    await page.getByRole('button', { name: 'European AQI (EEA)' }).click();
    await expect(page.getByTestId('primary-aqi-value')).toHaveText('69');
    await expect(page.getByTestId('companion-aqi-value')).toHaveText('118');

    // Verify 6 pollutants and honest Unavailable handling for missing SO2
    await expect(page.getByTestId('pollutant-value-pm2_5')).toHaveText('42.3');
    await expect(page.getByTestId('pollutant-value-so2')).toHaveText('Unavailable');

    // Verify interactive 48h forecast fetch & accessible table toggle
    await page.getByRole('button', { name: '48h forecast' }).click();
    await page.getByRole('button', { name: 'Table view' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(49); // 1 header + 48 hourly rows

    // Verify fog vs smog distinction note
    await expect(
      page.getByText(/water-vapor fog alone does not mean winter smog is high/i),
    ).toBeVisible();

    // Update location via inline Change location form
    await page.getByRole('button', { name: 'Change location' }).click();
    await page.locator('#aq-location-city').fill('Warsaw');
    await page.locator('#aq-location-neighborhood').fill('Mokotow');
    await page.locator('#aq-location-postal').fill('02-5');
    await page.getByRole('button', { name: 'Save location' }).click();

    await expect(
      page.getByRole('heading', { level: 2, name: /Mokotow, Warsaw, Poland/i }),
    ).toBeVisible();
    await expect(page.getByTestId('primary-aqi-value')).toHaveText('38');

    // No horizontal page overflow across desktop or Pixel 7 mobile
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);

    // Full-page WCAG 2.2 AA audit
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('renders stale cached fallback disclosure and honest unavailable state without fabricated figures', async ({
    page,
  }) => {
    await setupHarnessApiRoutes(page, { freshness: 'stale' });
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');
    await expect(page.getByText(/Displaying cached air quality readings/i)).toBeVisible();

    await page.unrouteAll();
    await setupHarnessApiRoutes(page, { freshness: 'unavailable' });
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');

    await expect(page.getByText(/Live air quality data temporarily unavailable/i)).toBeVisible();
    await expect(page.getByTestId('primary-aqi-value')).toHaveText('Unavailable');
    await expect(
      page.getByRole('heading', { level: 2, name: /General Clean-Air Precautions/i }),
    ).toBeVisible();

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
