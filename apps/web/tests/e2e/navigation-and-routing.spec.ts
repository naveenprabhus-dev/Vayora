import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function buildApiEnvelope<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      requestId: 'e2e-nav-req-1',
      timestamp: '2026-11-23T09:00:00.000Z',
    },
  };
}

const BASE_LOCATION = {
  city: 'Krakow',
  neighborhood: 'Krowodrza',
  country: 'Poland',
  postalPrefix: '30-01',
  resolvedLabel: 'Krakow, Poland',
  latitude: 50.061,
  longitude: 19.937,
  timezone: 'Europe/Warsaw',
  resolutionSource: 'saved_profile_geocoded',
};

const AQ_TRANSPARENCY = {
  providerId: 'open-meteo',
  providerName: 'Open-Meteo Air Quality',
  dataNature: 'model_forecast',
  dataNatureDisclosure: 'Model-generated atmospheric forecast.',
  attribution: 'Open-Meteo CC BY 4.0',
  freshnessStatus: 'fresh',
  availabilityStatus: 'available',
  observationTimestamp: '2026-11-23T09:00:00Z',
  fetchedAt: '2026-11-23T09:01:00Z',
  cacheAgeSeconds: 5,
  fallbackActive: false,
  fallbackReason: null,
  methodologySummary: 'Independent EPA & EEA scales.',
};

const AQ_CONTEXT = {
  usAqi: {
    scale: 'us_aqi',
    scaleLabel: 'US AQI (EPA)',
    authorityLabel: 'U.S. EPA',
    value: 92,
    status: 'available',
    category: 'Moderate',
    pollutionLevel: 'moderate',
    pollutionLevelLabel: 'Moderate pollution level',
    severityToken: 'moderate',
    meaning: 'Moderate particulates.',
    precautionSummary: 'Monitor unusually sensitive outdoor exposure.',
    methodologyNote: 'US EPA.',
  },
  europeanAqi: {
    scale: 'european_aqi',
    scaleLabel: 'European AQI (EEA)',
    authorityLabel: 'EEA',
    value: 44,
    status: 'available',
    category: 'Moderate',
    pollutionLevel: 'moderate',
    pollutionLevelLabel: 'Moderate pollution level',
    severityToken: 'moderate',
    meaning: 'Moderate air quality.',
    precautionSummary: 'Monitor traffic peaks.',
    methodologyNote: 'EEA.',
  },
  dominantPollutant: {
    status: 'available',
    code: 'pm2_5',
    abbreviation: 'PM2.5',
    fullName: 'Fine Particulate Matter',
    basis: 'provider_sub_index',
    estimatedSubIndex: 92,
    explanation: 'PM2.5 dominates.',
  },
  transparency: AQ_TRANSPARENCY,
};

async function setupNavigationRoutes(page: Page) {
  let profile = {
    ownerUid: 'uid_e2e_family',
    country: 'Poland',
    city: 'Krakow',
    neighborhood: 'Krowodrza',
    postalPrefix: '30-01',
    locationPreferences: { primaryZoneType: 'valley_basin', alertsEnabled: true },
    householdSize: 4,
    householdComposition: ['adults', 'young_children'],
    primaryCommuteMode: 'public_transit',
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

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname;

    if (pathname.endsWith('/auth/session')) {
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
              role: 'member',
              authTimeSeconds: 1700000000,
            },
          }),
        ),
      });
      return;
    }

    if (pathname.endsWith('/auth/password-reset-audit')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildApiEnvelope({ accepted: true })),
      });
      return;
    }

    if (pathname.endsWith('/household/profile') && req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildApiEnvelope({ profile })),
      });
      return;
    }

    if (pathname.endsWith('/household/profile') && req.method() === 'PUT') {
      const body = req.postDataJSON() as typeof profile;
      profile = { ...profile, ...body, ownerUid: 'uid_e2e_family' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildApiEnvelope({ profile })),
      });
      return;
    }

    if (pathname.endsWith('/air-quality/current')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildApiEnvelope({
            location: BASE_LOCATION,
            aqi: {
              usAqi: AQ_CONTEXT.usAqi,
              europeanAqi: AQ_CONTEXT.europeanAqi,
              dominantPollutant: AQ_CONTEXT.dominantPollutant,
            },
            pollutants: [
              {
                code: 'pm2_5',
                fullName: 'Fine Particulate Matter',
                abbreviation: 'PM2.5',
                concentration: 28.4,
                unit: 'µg/m³',
                status: 'available',
                concentrationBand: 'moderate',
                concentrationBandLabel: 'Moderate',
                explanation: 'Fine particulates.',
                distinctionNote: 'Mass concentration.',
              },
            ],
            forecastPreview: [
              {
                timestamp: '2026-11-23T09:00:00Z',
                usAqi: 92,
                europeanAqi: 44,
                pm25: 28.4,
                pm10: 34,
                no2: 19,
                so2: 4,
                co: 280,
                o3: 32,
                availability: 'available',
              },
            ],
            guidance: {
              status: 'measured_evidence',
              headline: 'Moderate particulate burden in Krakow',
              summary: 'Use midday windows when possible.',
              fogDistinctionNote: 'Water vapor fog alone is distinct from winter smog.',
              guidanceScopeNote: 'Educational environmental guidance.',
              actions: [],
            },
            transparency: AQ_TRANSPARENCY,
          }),
        ),
      });
      return;
    }

    if (pathname.endsWith('/air-quality/forecast')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildApiEnvelope({
            location: BASE_LOCATION,
            horizonHours: 24,
            dataNature: 'model_forecast',
            units: { usAqi: 'US AQI', europeanAqi: 'EAQI', pollutants: 'µg/m³' },
            hourly: [],
            transparency: AQ_TRANSPARENCY,
          }),
        ),
      });
      return;
    }

    if (pathname.endsWith('/routines/daily')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildApiEnvelope({
            routineId: 'nav-routine-1',
            generatedAt: '2026-11-23T09:00:00Z',
            cachedResult: false,
            location: BASE_LOCATION,
            profileContext: {
              primaryZoneType: 'valley_basin',
              householdSize: 4,
              householdComposition: ['adults', 'young_children'],
              savedCommuteMode: 'public_transit',
              effectiveCommuteMode: 'public_transit',
              savedOutdoorPattern: 'school_run_family',
              effectiveOutdoorPattern: 'school_run_family',
              heatingType: 'district',
              ventilationContext: 'natural_windows',
              hasIndoorAirPurifier: true,
              preferredGuidanceFocus: 'balanced',
              isScenarioPreview: false,
            },
            airQualityContext: { ...AQ_CONTEXT, pollutants: [] },
            overview: {
              headline: 'Low-Emission Daily Routines',
              summary: 'Structured by time window.',
              totalRecommended: 1,
              totalOptional: 0,
              totalUnavailable: 0,
              exposureCount: 1,
              emissionCount: 0,
              bothCount: 0,
              safetyAndScopeNotice: 'Educational guidance only.',
            },
            betterTimeWindows: {
              status: 'available',
              windows: [
                {
                  startIso: '2026-11-23T13:00:00Z',
                  endIso: '2026-11-23T15:00:00Z',
                  label: '13:00–15:00',
                  expectedUsAqi: 68,
                  expectedEuropeanAqi: 35,
                  rationale: 'Improved afternoon dispersion.',
                },
              ],
              limitationDisclosure: 'Atmospheric model estimate.',
            },
            commuteSummary: {
              savedMode: 'public_transit',
              effectiveMode: 'public_transit',
              headline: 'Transit commute aligned',
              exposureVsEmissionsNote: 'Exposure and emissions shown separately.',
              options: [],
            },
            periods: [
              {
                period: 'morning',
                label: 'Morning window',
                windowHint: '07:00–09:00',
                items: [
                  {
                    id: 'morning-transit-walk',
                    period: 'morning',
                    title: 'Use side-street path to tram stop',
                    status: 'recommended',
                    statusLabel: 'Suitable now',
                    impactClassification: 'personal_exposure',
                    impactClassificationLabel: 'Personal exposure reduction',
                    suggestedWindow: '07:45–08:15',
                    explanation: {
                      whatToDo: 'Walk one block off main arterial road.',
                      whyHelps: 'Reduces curbside exhaust spikes.',
                      tradeoffsOrLimitations: 'Adds 2 minutes walking time.',
                    },
                    evidenceReference: {
                      sourceName: 'EEA',
                      sourceUrl: 'https://www.eea.europa.eu',
                      versionOrDate: '2025',
                    },
                  },
                ],
              },
            ],
          }),
        ),
      });
      return;
    }

    if (pathname.endsWith('/indoor-air/guidance')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildApiEnvelope({
            guidanceId: 'nav-indoor-1',
            generatedAt: '2026-11-23T09:00:00Z',
            cachedResult: false,
            location: BASE_LOCATION,
            overview: {
              headline: 'Indoor Air Quality Assistant (Krakow)',
              summary: 'Qualitative indoor precautions.',
              householdSize: 4,
              householdComposition: ['adults', 'young_children'],
              ventilationContext: 'natural_windows',
              hasIndoorAirPurifier: true,
              heatingType: 'district',
              primaryZoneType: 'valley_basin',
              outdoorConditionSummary: 'Moderate PM2.5.',
              sensorStatus: {
                sensorConnected: false,
                disclosureStatement:
                  'Indoor air quality is not being measured. These recommendations are based on your household settings, available outdoor air-quality information and general guidance.',
                evidenceDistinctions: [],
              },
            },
            airQualityContext: { ...AQ_CONTEXT, pollutants: [] },
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
              stateLabel: 'Timed airing',
              headline: 'Air rooms briefly between traffic peaks',
              summary: 'Timed cross-ventilation.',
              bestWindowHint: null,
              windowDisclosure: 'Atmospheric model estimate.',
              essentialSafetyReminder: 'Keep safety vents clear.',
              constraintsAndTradeoffs: ['No indoor sensor.'],
              informationCategory: 'estimated_inferred_indoor',
            },
            purifierGuidance: {
              hasPurifier: true,
              scenarioSimulatedPurifier: false,
              headline: 'HEPA filtration guidance',
              summary: 'Particles only.',
              practicalGuidance: ['Run during cooking.'],
              gasAndVocLimitation: 'HEPA filters do not capture carbon monoxide.',
              nonPurchaseNote: 'Use existing purifier setup.',
              informationCategory: 'general_educational_guidance',
            },
            actionPlan: [],
            pollutionSources: [],
            provenanceAndSafety: {
              dataSources: ['Household profile'],
              nonMedicalNotice: 'Educational guidance only.',
              limitationsSummary: 'No indoor sensors connected.',
            },
          }),
        ),
      });
      return;
    }

    if (pathname.endsWith('/alternatives/recommendations')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildApiEnvelope({
            advisoryId: 'nav-alt-1',
            generatedAt: '2026-11-23T09:00:00Z',
            cachedResult: false,
            location: BASE_LOCATION,
            overview: {
              headline: 'Sustainable Alternatives Advisor (Krakow)',
              summary: 'Household alternatives.',
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
                ventilationContext: 'natural_windows',
                primaryZoneType: 'valley_basin',
              },
              outdoorConditionSummary: 'Moderate PM2.5.',
              impactDistinctionLegend: [],
              activeTransportAqiNote: 'Monitor PM2.5 before prolonged cycling.',
            },
            appliedFilters: {
              category: null,
              affordability: null,
              relevance: null,
              impactType: null,
              practicality: null,
            },
            airQualityContext: AQ_CONTEXT,
            alternatives: [],
            featuredComparison: null,
            provenanceAndDisclosures: {
              dataSources: ['Profile'],
              methodologicalPrinciples: ['Qualitative only.'],
              limitationsSummary: 'Conditional.',
            },
          }),
        ),
      });
      return;
    }

    if (pathname.endsWith('/advisory/briefing')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildApiEnvelope({
            briefingId: 'nav-briefing-1',
            location: BASE_LOCATION,
            householdSummary: {
              city: 'Krakow',
              neighborhood: 'Krowodrza',
              primaryZoneType: 'valley_basin',
              householdSize: 4,
              householdComposition: ['adults', 'young_children'],
              primaryCommuteMode: 'public_transit',
              outdoorActivityPattern: 'school_run_family',
              ventilationContext: 'natural_windows',
              hasIndoorAirPurifier: true,
              heatingType: 'district',
              preferredGuidanceFocus: 'balanced',
            },
            airQualitySnapshot: {
              freshnessStatus: 'fresh',
              availabilityStatus: 'available',
              observationTimestamp: '2026-11-23T09:00:00Z',
              usAqiValue: 92,
              usAqiCategory: 'Moderate',
              europeanAqiValue: 44,
              europeanAqiCategory: 'Moderate',
              dominantPollutantCode: 'pm2_5',
              dominantPollutantLabel: 'PM2.5',
              isHighOrWorse: false,
              isElevatedOrWorse: true,
              isCyclingNotAdvised: false,
              bestForecastWindowLabel: '13:00–15:00',
              aqSummary: 'US AQI 92 (Moderate).',
              activeScaleNote: 'dual_epa_eea',
            },
            headline: 'Timed airing and calm side-street transit recommended in Krakow',
            summary: 'Afternoon window offers lower particulate levels.',
            outdoorInfluenceSummary: 'Model forecast indicates moderate PM2.5.',
            indoorContextSummary: 'No indoor sensors connected.',
            priorityActions: [
              {
                recommendationId: 'rec-1',
                sourceModule: 'routines',
                title: 'Use side-street path to tram stop',
                rationale: 'Cuts curbside tailpipe peak exposure.',
                impactCategory: 'personal_exposure',
                impactCategoryLabel: 'Personal exposure reduction',
                deterministicStatus: 'recommended',
              },
              {
                recommendationId: 'rec-2',
                sourceModule: 'indoor',
                title: 'Run HEPA purifier after kitchen cooking',
                rationale: 'Captures fine cooking particles.',
                impactCategory: 'personal_exposure',
                impactCategoryLabel: 'Personal exposure reduction',
                deterministicStatus: 'recommended_now',
              },
              {
                recommendationId: 'rec-3',
                sourceModule: 'alternatives',
                title: 'Batch errands into one afternoon trip',
                rationale: 'Avoids morning peak congestion.',
                impactCategory: 'both_exposure_and_emissions',
                impactCategoryLabel: 'Both personal exposure and local emissions',
                deterministicStatus: 'recommended',
              },
            ],
            cautionsAndLimitations: 'Educational environmental guidance only.',
            verifiedEvidence: [],
            availableRecommendations: [],
            generationMeta: {
              generationMode: 'gemini',
              model: 'gemini-4-hydrogen',
              fallbackReason: null,
              aiDisclosure: 'Synthesized by Gemini from verified VAYORA rules.',
              nonMedicalNotice: 'Educational guidance only.',
              freshnessDisclosure: 'fresh',
              freshnessMessage: 'Fresh telemetry.',
              contextFingerprint: 'nav-fp',
              cachedResult: false,
              generatedAt: '2026-11-23T09:00:00Z',
              latencyMs: 25,
              focus: 'balanced',
            },
          }),
        ),
      });
      return;
    }

    await route.continue();
  });
}

test.describe('Phase 2 Navigation, Nested Routing, Responsive Sidebar & Mobile Drawer (E2E)', () => {
  test('serves HTTP 200 on all nested SPA routes and blocks unauthenticated direct visits with redirect to login', async ({
    page,
  }) => {
    const routes = [
      '/overview',
      '/air-quality',
      '/daily-routines',
      '/indoor-air',
      '/sustainable-alternatives',
      '/household',
      '/settings',
    ];

    for (const routePath of routes) {
      const response = await page.goto(routePath);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole('heading', { level: 1, name: /Sign in to Urban Air Quality Assistant/i }),
      ).toBeVisible();
    }
  });

  test('supports all 7 workspace pages, active state, browser history, page reload persistence, sidebar collapse, mobile drawer focus management, and WCAG 2.2 AA', async ({
    page,
    isMobile,
  }) => {
    await setupNavigationRoutes(page);
    await page.goto('/apps/web/tests/e2e/dashboard-harness.html');

    await expect(page.getByTestId('page-overview')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: /Air Quality Overview/i }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Overview · VAYORA/i);

    if (isMobile) {
      // Mobile responsive drawer behavior & focus restoration
      const trigger = page.getByTestId('mobile-menu-trigger');
      await expect(trigger).toBeVisible();
      await trigger.click();

      const drawer = page.getByRole('dialog', { name: 'Mobile navigation menu' });
      await expect(drawer).toBeVisible();
      await expect(page.getByTestId('mobile-menu-close')).toBeFocused();

      // Escape dismisses drawer and returns focus to trigger button
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await expect(trigger).toBeFocused();

      // Selecting a page auto-closes the drawer
      await trigger.click();
      await page.getByTestId('mobile-nav-air-quality').click();
      await expect(drawer).toBeHidden();
      await expect(page.getByTestId('page-air-quality')).toBeVisible();
    } else {
      // Desktop persistent sidebar collapse/expand & tooltip check
      const sidebar = page.getByTestId('desktop-sidebar');
      await expect(sidebar).toBeVisible();
      await expect(sidebar).toHaveAttribute('data-collapsed', 'false');

      await page.getByTestId('sidebar-collapse-toggle').click();
      await expect(sidebar).toHaveAttribute('data-collapsed', 'true');

      const aqNav = page.getByTestId('sidebar-nav-air-quality');
      await aqNav.hover();
      await expect(page.getByTestId('sidebar-tooltip-air-quality')).toHaveCSS('opacity', '1');

      // Expand back and navigate across pages
      await page.getByTestId('sidebar-collapse-toggle').click();
      await expect(sidebar).toHaveAttribute('data-collapsed', 'false');

      await aqNav.click();
      await expect(page.getByTestId('page-air-quality')).toBeVisible();
      await expect(aqNav).toHaveAttribute('aria-current', 'page');
      await expect(page).toHaveTitle(/Air Quality · VAYORA/i);
    }

    // Visit remaining pages
    const destinations: ReadonlyArray<{
      readonly id:
        | 'daily-routines'
        | 'indoor-air'
        | 'sustainable-alternatives'
        | 'household'
        | 'settings';
      readonly heading: RegExp;
    }> = [
      { id: 'daily-routines', heading: /Low-Emission Daily Routines/i },
      { id: 'indoor-air', heading: /Indoor Air Quality Assistant/i },
      { id: 'sustainable-alternatives', heading: /Sustainable Alternatives Advisor/i },
      { id: 'household', heading: /My Household/i },
      { id: 'settings', heading: /Settings/i },
    ];

    for (const dest of destinations) {
      if (isMobile) {
        await page.getByTestId('mobile-menu-trigger').click();
        await page.getByTestId(`mobile-nav-${dest.id}`).click();
      } else {
        await page.getByTestId(`sidebar-nav-${dest.id}`).click();
      }
      await expect(page.getByTestId(`page-${dest.id}`)).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 1, name: dest.heading }),
      ).toBeVisible();
    }

    // Verify Settings save action & password reset
    await page.getByLabel('Preferred guidance focus').selectOption('indoor_air');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(
      page.getByText(/Guidance focus and smog alert settings have been saved/i),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Send password reset email' }).click();
    await expect(
      page.getByText(/Password reset instructions have been sent to elena@household\.org/i),
    ).toBeVisible();

    // Browser Back/Forward navigation
    await page.goBack();
    await expect(page.getByTestId('page-household')).toBeVisible();
    await expect(page.getByText('uid_e2e_family')).toBeVisible();

    await page.goForward();
    await expect(page.getByTestId('page-settings')).toBeVisible();

    // Reload directly on nested ?page=settings restores Settings cleanly
    await page.reload();
    await expect(page.getByTestId('page-settings')).toBeVisible();

    // Verify zero horizontal overflow across desktop & mobile
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    // Accessibility check
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
