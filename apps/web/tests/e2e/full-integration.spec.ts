import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function wrapSuccess<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      requestId: 'e2e-full-int-1',
      timestamp: '2026-11-23T09:00:00.000Z',
    },
  };
}

interface MockHouseholdState {
  country: string;
  city: string;
  neighborhood: string;
  postalPrefix: string;
  locationPreferences: { primaryZoneType: string; alertsEnabled: boolean };
  householdSize: number;
  householdComposition: string[];
  primaryCommuteMode: string;
  outdoorActivityPattern: string;
  ventilationContext: string;
  hasIndoorAirPurifier: boolean;
  heatingType: string;
  lifestylePreferences: { preferredGuidanceFocus: string; reminderCadence: string };
  onboardingCompleted: boolean;
}

async function setupStatefulBackendRoutes(page: Page) {
  let profile: MockHouseholdState = {
    country: 'Poland',
    city: 'Krakow',
    neighborhood: 'Krowodrza',
    postalPrefix: '30-01',
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
  };

  const apiRequestCounts = {
    airQualityCurrent: 0,
    routinesDaily: 0,
    indoorGuidance: 0,
    alternatives: 0,
    advisoryBriefing: 0,
  };

  function makeLocation(city: string, neighborhood: string, postalPrefix: string) {
    const isGdansk = city.toLowerCase() === 'gdansk';
    return {
      city,
      neighborhood,
      country: profile.country,
      postalPrefix,
      resolvedLabel: `${city}, ${profile.country}`,
      latitude: isGdansk ? 54.352 : 50.061,
      longitude: isGdansk ? 18.646 : 19.937,
      timezone: 'Europe/Warsaw',
      resolutionSource: 'saved_profile_geocoded',
    };
  }

  function makeAqPayload() {
    const isGdansk = profile.city.toLowerCase() === 'gdansk';
    const usAqiVal = isGdansk ? 26 : 148;
    const euAqiVal = isGdansk ? 14 : 76;
    const location = makeLocation(profile.city, profile.neighborhood, profile.postalPrefix);
    return {
      location,
      aqi: {
        usAqi: {
          scale: 'us_aqi',
          scaleLabel: 'US AQI (EPA)',
          authorityLabel: 'U.S. EPA 0–500 Scale',
          value: usAqiVal,
          status: 'available',
          category: isGdansk ? 'Good' : 'Unhealthy for Sensitive Groups',
          pollutionLevel: isGdansk ? 'low' : 'moderate',
          pollutionLevelLabel: isGdansk
            ? 'Low pollution level'
            : 'Moderate–elevated pollution level',
          severityToken: isGdansk ? 'good' : 'elevated',
          meaning: `${profile.city} EPA particulate assessment.`,
          precautionSummary: isGdansk
            ? 'Normal outdoor activity.'
            : 'Limit strenuous outdoor play.',
          methodologyNote: 'Independent EPA scale.',
        },
        europeanAqi: {
          scale: 'european_aqi',
          scaleLabel: 'European AQI (EEA)',
          authorityLabel: 'EEA 0–100+ Index',
          value: euAqiVal,
          status: 'available',
          category: isGdansk ? 'Good' : 'Poor',
          pollutionLevel: isGdansk ? 'low' : 'high',
          pollutionLevelLabel: isGdansk ? 'Low pollution level' : 'High pollution level',
          severityToken: isGdansk ? 'good' : 'high',
          meaning: `${profile.city} EEA index.`,
          precautionSummary: 'Monitor corridor traffic.',
          methodologyNote: 'Independent EEA scale.',
        },
        dominantPollutant: {
          status: 'available',
          code: 'pm2_5',
          abbreviation: 'PM2.5',
          fullName: 'Fine Particulate Matter',
          basis: 'provider_sub_index',
          estimatedSubIndex: usAqiVal,
          explanation: 'Fine particulate matter dominates.',
        },
      },
      pollutants: [
        {
          code: 'pm2_5',
          fullName: 'Fine Particulate Matter',
          abbreviation: 'PM2.5',
          concentration: isGdansk ? 7.4 : 52.0,
          unit: 'µg/m³',
          status: 'available',
          concentrationBand: isGdansk ? 'low' : 'high',
          concentrationBandLabel: isGdansk ? 'Low' : 'High',
          explanation: 'Fine particulates.',
          distinctionNote: 'Mass concentration in µg/m³.',
        },
      ],
      forecastPreview: [
        {
          timestamp: '2026-11-23T09:00:00Z',
          usAqi: usAqiVal,
          europeanAqi: euAqiVal,
          pm25: isGdansk ? 7.4 : 52.0,
          pm10: 24,
          no2: 18,
          so2: 4,
          co: 290,
          o3: 36,
          availability: 'available',
        },
      ],
      guidance: {
        status: 'measured_evidence',
        headline: `Outdoor air guidance for ${profile.city}`,
        summary: 'Evidence-based atmospheric guidance.',
        fogDistinctionNote: 'Water vapor fog alone does not imply smog.',
        guidanceScopeNote: 'Educational environmental guidance.',
        actions: [],
      },
      transparency: {
        providerId: 'open-meteo',
        providerName: 'Open-Meteo Air Quality',
        dataNature: 'model_forecast',
        dataNatureDisclosure:
          'Model-generated atmospheric chemistry estimate (not direct street sensor measurements).',
        attribution: 'Data provided by Open-Meteo.com (CC BY 4.0)',
        freshnessStatus: 'fresh',
        availabilityStatus: 'available',
        observationTimestamp: '2026-11-23T09:00:00Z',
        fetchedAt: '2026-11-23T09:02:00Z',
        cacheAgeSeconds: 0,
        fallbackActive: false,
        fallbackReason: null,
        methodologySummary: 'Separate EPA and EEA AQI methodologies.',
      },
    };
  }

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname;

    if (pathname.endsWith('/auth/session')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrapSuccess({
            authenticated: true,
            principal: {
              uid: 'uid_e2e_family',
              email: 'elena@household.org',
              emailVerified: true,
              role: 'member',
              authTimeSeconds: 1700000000,
            },
          }),
        ),
      });
      return;
    }

    if (pathname.endsWith('/household/profile') && req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrapSuccess({ profile: { ownerUid: 'uid_e2e_family', ...profile } })),
      });
      return;
    }

    if (pathname.endsWith('/household/profile') && req.method() === 'PUT') {
      const body = req.postDataJSON() as MockHouseholdState;
      profile = { ...body };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrapSuccess({ profile: { ownerUid: 'uid_e2e_family', ...profile } })),
      });
      return;
    }

    if (pathname.endsWith('/air-quality/current')) {
      apiRequestCounts.airQualityCurrent += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrapSuccess(makeAqPayload())),
      });
      return;
    }

    if (pathname.endsWith('/routines/daily') || pathname.endsWith('/routines/refresh')) {
      apiRequestCounts.routinesDaily += 1;
      const aq = makeAqPayload();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrapSuccess({
            routineId: `r-${profile.city}`,
            generatedAt: '2026-11-23T09:02:00Z',
            cachedResult: false,
            location: aq.location,
            profileContext: {
              primaryZoneType: profile.locationPreferences.primaryZoneType,
              householdSize: profile.householdSize,
              householdComposition: profile.householdComposition,
              savedCommuteMode: profile.primaryCommuteMode,
              effectiveCommuteMode: profile.primaryCommuteMode,
              savedOutdoorPattern: profile.outdoorActivityPattern,
              effectiveOutdoorPattern: profile.outdoorActivityPattern,
              heatingType: profile.heatingType,
              ventilationContext: profile.ventilationContext,
              hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
              preferredGuidanceFocus: profile.lifestylePreferences.preferredGuidanceFocus,
              isScenarioPreview: false,
            },
            airQualityContext: {
              ...aq.aqi,
              pollutants: aq.pollutants,
              transparency: aq.transparency,
            },
            overview: {
              headline: `Daily routines tailored for ${profile.city}`,
              summary: 'Exposure protection and lower-emission schedule.',
              totalRecommended: 1,
              totalOptional: 0,
              totalUnavailable: 0,
              exposureCount: 1,
              emissionCount: 0,
              bothCount: 0,
              safetyAndScopeNotice: 'Educational guidance; never medical diagnosis.',
            },
            betterTimeWindows: {
              status: 'available',
              windows: [],
              limitationDisclosure: 'Atmospheric model estimate only.',
            },
            commuteSummary: {
              savedMode: profile.primaryCommuteMode,
              effectiveMode: profile.primaryCommuteMode,
              headline: 'Commute alignment',
              exposureVsEmissionsNote: 'Exposure and emissions evaluated separately.',
              options: [],
            },
            periods: [],
          }),
        ),
      });
      return;
    }

    if (pathname.endsWith('/indoor-air/guidance') || pathname.endsWith('/indoor-air/refresh')) {
      apiRequestCounts.indoorGuidance += 1;
      const aq = makeAqPayload();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrapSuccess({
            guidanceId: `i-${profile.city}`,
            generatedAt: '2026-11-23T09:02:00Z',
            cachedResult: false,
            location: aq.location,
            overview: {
              headline: `Indoor air guidance for ${profile.city}`,
              summary: 'Qualitative indoor precautions based on household setup.',
              householdSize: profile.householdSize,
              householdComposition: profile.householdComposition,
              ventilationContext: profile.ventilationContext,
              hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
              heatingType: profile.heatingType,
              primaryZoneType: profile.locationPreferences.primaryZoneType,
              outdoorConditionSummary: `${profile.city} conditions.`,
              sensorStatus: {
                sensorConnected: false,
                disclosureStatement: 'No indoor air sensors connected.',
                evidenceDistinctions: [],
              },
            },
            airQualityContext: {
              ...aq.aqi,
              pollutants: aq.pollutants,
              transparency: aq.transparency,
            },
            scenarioContext: {
              selectedScenario: 'baseline',
              isSimulation: false,
              simulationLabel: 'Baseline',
              scenarioTitle: 'Baseline',
              scenarioDescription: 'Saved home setup.',
              scenarioFocusNotes: [],
              availableScenarios: [],
            },
            ventilationGuidance: {
              state: 'shorter_timed_ventilation',
              stateLabel: 'Targeted airing',
              headline: 'Use brief cross-ventilation during lower outdoor pollution hours',
              summary: 'Ventilation advice.',
              bestWindowHint: null,
              windowDisclosure: 'Atmospheric model timing only.',
              essentialSafetyReminder: 'Keep combustion safety vents unobstructed.',
              constraintsAndTradeoffs: ['No indoor measurements.'],
              informationCategory: 'estimated_inferred_indoor',
            },
            purifierGuidance: {
              hasPurifier: profile.hasIndoorAirPurifier,
              scenarioSimulatedPurifier: false,
              headline: 'HEPA particle filtration guidance',
              summary: 'Particles only.',
              practicalGuidance: ['Run during cooking.'],
              gasAndVocLimitation: 'HEPA filters capture particles, not carbon monoxide.',
              nonPurchaseNote: 'Use existing ventilation habits.',
              informationCategory: 'general_educational_guidance',
            },
            actionPlan: [],
            pollutionSources: [],
            provenanceAndSafety: {
              dataSources: ['Profile', 'Open-Meteo'],
              nonMedicalNotice: 'Educational guidance only.',
              limitationsSummary: 'No indoor sensors.',
            },
          }),
        ),
      });
      return;
    }

    if (
      pathname.endsWith('/alternatives/recommendations') ||
      pathname.endsWith('/alternatives/refresh')
    ) {
      apiRequestCounts.alternatives += 1;
      const aq = makeAqPayload();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrapSuccess({
            advisoryId: `a-${profile.city}`,
            generatedAt: '2026-11-23T09:02:00Z',
            cachedResult: false,
            location: aq.location,
            overview: {
              headline: `Sustainable alternatives for ${profile.city}`,
              summary: 'Practical choices matched to household context.',
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
                householdSize: profile.householdSize,
                householdComposition: profile.householdComposition,
                primaryCommuteMode: profile.primaryCommuteMode,
                heatingType: profile.heatingType,
                ventilationContext: profile.ventilationContext,
                primaryZoneType: profile.locationPreferences.primaryZoneType,
              },
              outdoorConditionSummary: `${profile.city} conditions.`,
              impactDistinctionLegend: [],
              activeTransportAqiNote: 'AQI-aware transport safeguard.',
            },
            appliedFilters: {
              category: null,
              affordability: null,
              relevance: null,
              impactType: null,
              practicality: null,
            },
            airQualityContext: { ...aq.aqi, transparency: aq.transparency },
            alternatives: [],
            featuredComparison: null,
            provenanceAndDisclosures: {
              dataSources: ['Profile', 'Open-Meteo'],
              methodologicalPrinciples: ['Qualitative only.'],
              limitationsSummary: 'No invented metrics.',
            },
          }),
        ),
      });
      return;
    }

    if (pathname.endsWith('/advisory/briefing') || pathname.endsWith('/advisory/refresh')) {
      apiRequestCounts.advisoryBriefing += 1;
      const aq = makeAqPayload();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrapSuccess({
            briefingId: `b-${profile.city}`,
            location: aq.location,
            householdSummary: {
              city: profile.city,
              neighborhood: profile.neighborhood,
              primaryZoneType: profile.locationPreferences.primaryZoneType,
              householdSize: profile.householdSize,
              householdComposition: profile.householdComposition,
              primaryCommuteMode: profile.primaryCommuteMode,
              outdoorActivityPattern: profile.outdoorActivityPattern,
              ventilationContext: profile.ventilationContext,
              hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
              heatingType: profile.heatingType,
              preferredGuidanceFocus: profile.lifestylePreferences.preferredGuidanceFocus,
            },
            airQualitySnapshot: {
              freshnessStatus: 'fresh',
              availabilityStatus: 'available',
              observationTimestamp: '2026-11-23T09:00:00Z',
              usAqiValue: aq.aqi.usAqi.value,
              usAqiCategory: aq.aqi.usAqi.category,
              europeanAqiValue: aq.aqi.europeanAqi.value,
              europeanAqiCategory: aq.aqi.europeanAqi.category,
              dominantPollutantCode: 'pm2_5',
              dominantPollutantLabel: 'PM2.5',
              isHighOrWorse: false,
              isElevatedOrWorse: profile.city !== 'Gdansk',
              isCyclingNotAdvised: false,
              bestForecastWindowLabel: null,
              aqSummary: `${profile.city} outdoor air.`,
              activeScaleNote: 'dual_epa_eea',
            },
            headline: `Personalized briefing in ${profile.city}`,
            summary: 'Deterministic fallback explanation synchronized across modules.',
            outdoorInfluenceSummary: `${profile.city} AQI is tracked on separate EPA and EEA scales.`,
            indoorContextSummary: 'No indoor sensors connected.',
            priorityActions: [],
            cautionsAndLimitations: 'Educational environmental guidance only.',
            verifiedEvidence: [
              {
                id: 'EV-OPEN-METEO',
                sourceName: 'Open-Meteo Air Quality',
                sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
                scope: 'Outdoor atmospheric model',
                relevantFinding: 'Model forecast values.',
                limitations: 'Not direct sensor readings.',
              },
            ],
            availableRecommendations: [],
            generationMeta: {
              generationMode: 'deterministic_fallback',
              model: 'deterministic-rules',
              fallbackReason: 'Simulated Gemini unavailability for E2E verification.',
              aiDisclosure: 'Deterministic fallback explanation built from verified rules.',
              nonMedicalNotice: 'Educational guidance only.',
              freshnessDisclosure: 'fresh',
              freshnessMessage: 'Fresh telemetry.',
              contextFingerprint: `fp-${profile.city}`,
              cachedResult: false,
              generatedAt: '2026-11-23T09:02:00Z',
              latencyMs: 5,
              focus: 'balanced',
            },
          }),
        ),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found' },
        meta: { requestId: 'e2e-404', timestamp: '2026-11-23T09:00:00.000Z' },
      }),
    });
  });

  return { apiRequestCounts };
}

async function navigateWorkspaceFromShell(
  page: Page,
  isMobile: boolean,
  pageId:
    | 'overview'
    | 'air-quality'
    | 'daily-routines'
    | 'indoor-air'
    | 'sustainable-alternatives'
    | 'household'
    | 'settings',
) {
  if (isMobile) {
    await page.getByTestId('mobile-menu-trigger').click();
    await page.getByTestId(`mobile-nav-${pageId}`).click();
  } else {
    await page.getByTestId(`sidebar-nav-${pageId}`).click();
  }
}

test.describe('Phase 7 Full Application Integration & Multi-Page Consistency (Playwright)', () => {
  test('opens concisely on Overview without fetching unvisited modules, navigates cleanly across pages, propagates household updates, avoids overflow, and passes WCAG 2.2 AA', async ({
    page,
    isMobile,
  }) => {
    const { apiRequestCounts } = await setupStatefulBackendRoutes(page);
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');

    // Overview is default landing page and renders concise summary only
    await expect(page.getByTestId('page-overview')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: /Air Quality Overview/i }),
    ).toBeVisible();

    // Critical Phase 2 performance invariant: Indoor Air & Alternatives NOT fetched on Overview load
    expect(apiRequestCounts.advisoryBriefing).toBe(1);
    expect(apiRequestCounts.airQualityCurrent).toBe(1);
    expect(apiRequestCounts.routinesDaily).toBe(1);
    expect(apiRequestCounts.indoorGuidance).toBe(0);
    expect(apiRequestCounts.alternatives).toBe(0);

    // Deterministic fallback banner visible on Overview briefing card
    await expect(page.getByText('Deterministic fallback explanation active')).toBeVisible();

    // Navigate to Indoor Air via shell navigation -> lazy fetches Indoor Air cleanly
    await navigateWorkspaceFromShell(page, isMobile, 'indoor-air');
    await expect(page.getByTestId('indoor-air-assistant-workspace')).toBeVisible();
    expect(apiRequestCounts.indoorGuidance).toBe(1);

    // Navigate to My Household & edit profile -> propagates Gdansk across all pages
    await navigateWorkspaceFromShell(page, isMobile, 'household');
    await expect(page.getByTestId('page-household')).toBeVisible();

    await page.getByRole('button', { name: 'Edit preferences' }).click();
    await page.getByLabel(/City/).fill('Gdansk');
    await page.getByLabel(/Neighborhood or district/).fill('Wrzeszcz');
    await page.getByLabel(/Postal prefix/).fill('80-2');
    await page.getByRole('button', { name: 'Continue to Step 2' }).click();
    await page.getByRole('button', { name: 'Continue to Step 3' }).click();
    await page.getByRole('button', { name: 'Save updated preferences' }).click();

    await expect(page.getByText(/Wrzeszcz, Gdansk, Poland/).first()).toBeVisible();

    // Verify propagated Gdansk state across Overview, Air Quality, Daily Routines, Indoor Air, and Sustainable Alternatives
    await navigateWorkspaceFromShell(page, isMobile, 'overview');
    await expect(page.getByText('Personalized briefing in Gdansk')).toBeVisible();

    await navigateWorkspaceFromShell(page, isMobile, 'air-quality');
    await expect(
      page.getByRole('heading', { level: 2, name: /Wrzeszcz, Gdansk, Poland/ }),
    ).toBeVisible();

    await navigateWorkspaceFromShell(page, isMobile, 'daily-routines');
    await expect(page.getByText('Daily routines tailored for Gdansk')).toBeVisible();

    await navigateWorkspaceFromShell(page, isMobile, 'indoor-air');
    await expect(page.getByText('Indoor air guidance for Gdansk')).toBeVisible();

    await navigateWorkspaceFromShell(page, isMobile, 'sustainable-alternatives');
    await expect(page.getByText('Sustainable alternatives for Gdansk')).toBeVisible();

    // Verify no horizontal overflow on active viewport (desktop & mobile)
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    // Full-page WCAG 2.2 AA audit
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
