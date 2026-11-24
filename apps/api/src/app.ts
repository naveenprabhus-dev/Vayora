import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { loadConfig, type AppConfig } from './config/env.ts';
import { buildCorsOptions, buildHelmetOptions } from './config/security.ts';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.ts';
import { createApiRateLimiter } from './middleware/rateLimiter.ts';
import { attachRequestContext, requestLogger } from './middleware/requestContext.ts';
import { createAuthRouter } from './modules/auth/auth.routes.ts';
import { AirQualityCacheRepository } from './modules/air-quality/air-quality.repository.ts';
import { createAirQualityRouter } from './modules/air-quality/air-quality.routes.ts';
import { AirQualityService } from './modules/air-quality/air-quality.service.ts';
import type {
  AirQualityProvider,
  GeocodingProvider,
} from './modules/air-quality/providers/air-quality.provider.interface.ts';
import { OpenMeteoAirQualityProvider } from './modules/air-quality/providers/open-meteo.provider.ts';
import { AdvisoryCacheRepository } from './modules/advisory/advisory.cache.ts';
import { AdvisoryMetricsTracker } from './modules/advisory/advisory.metrics.ts';
import { createAdvisoryRouter } from './modules/advisory/advisory.routes.ts';
import { AdvisoryService } from './modules/advisory/advisory.service.ts';
import { AlternativesCacheRepository } from './modules/alternatives/alternatives.cache.ts';
import { createAlternativesRouter } from './modules/alternatives/alternatives.routes.ts';
import { SustainableAlternativesService } from './modules/alternatives/alternatives.service.ts';
import { createHealthRouter } from './modules/health/health.routes.ts';
import { createHouseholdRouter } from './modules/household/household.routes.ts';
import { IndoorCacheRepository } from './modules/indoor/indoor.cache.ts';
import { createIndoorRouter } from './modules/indoor/indoor.routes.ts';
import { IndoorAirService } from './modules/indoor/indoor.service.ts';
import { RoutinesCacheRepository } from './modules/routines/routines.cache.ts';
import { createRoutinesRouter } from './modules/routines/routines.routes.ts';
import { RoutinesService } from './modules/routines/routines.service.ts';
import { createSystemRouter } from './modules/system/system.routes.ts';
import {
  InMemoryHouseholdRepository,
  type HouseholdRepository,
} from './repositories/household.repository.ts';
import {
  GoogleGenAIAdvisoryClient,
  type GeminiAdvisoryClient,
} from './services/ai/geminiClient.ts';
import {
  FirebaseAdminTokenVerifier,
  ServerConfiguredRoleResolver,
  type RoleResolver,
  type TokenVerifier,
} from './services/auth/tokenVerifier.ts';

export interface ApiDependencies {
  readonly config?: AppConfig;
  readonly tokenVerifier?: TokenVerifier;
  readonly roleResolver?: RoleResolver;
  readonly householdRepository?: HouseholdRepository;
  readonly airQualityProvider?: AirQualityProvider;
  readonly geocodingProvider?: GeocodingProvider;
  readonly airQualityCacheRepository?: AirQualityCacheRepository;
  readonly routinesCacheRepository?: RoutinesCacheRepository;
  readonly indoorCacheRepository?: IndoorCacheRepository;
  readonly alternativesCacheRepository?: AlternativesCacheRepository;
  readonly geminiClient?: GeminiAdvisoryClient;
  readonly advisoryCacheRepository?: AdvisoryCacheRepository;
  readonly advisoryMetricsTracker?: AdvisoryMetricsTracker;
  readonly advisoryTimeoutMs?: number;
  readonly advisoryRateLimitMaxRequests?: number;
  readonly rateLimitMaxRequests?: number;
}

export function createApiRouter(deps: ApiDependencies = {}): Router {
  const config = deps.config ?? loadConfig();
  const tokenVerifier =
    deps.tokenVerifier ??
    new FirebaseAdminTokenVerifier({
      projectId: config.firebaseProjectId,
    });
  const roleResolver =
    deps.roleResolver ??
    new ServerConfiguredRoleResolver({
      adminEmails: config.adminEmails,
      coordinatorEmails: config.coordinatorEmails,
    });
  const householdRepository = deps.householdRepository ?? new InMemoryHouseholdRepository();

  const defaultOpenMeteoProvider = new OpenMeteoAirQualityProvider({
    airQualityBaseUrl: config.openMeteoAirQualityBaseUrl,
    geocodingBaseUrl: config.openMeteoGeocodingBaseUrl,
    timeoutMs: config.airQualityApiTimeoutMs,
  });
  const airQualityProvider = deps.airQualityProvider ?? defaultOpenMeteoProvider;
  const geocodingProvider = deps.geocodingProvider ?? defaultOpenMeteoProvider;
  const cacheRepository =
    deps.airQualityCacheRepository ??
    new AirQualityCacheRepository({
      cacheTtlMs: config.airQualityCacheTtlMs,
      staleTtlMs: config.airQualityStaleTtlMs,
      geocodeTtlMs: config.geocodingCacheTtlMs,
    });

  const airQualityService = new AirQualityService({
    airQualityProvider,
    geocodingProvider,
    householdRepository,
    cacheRepository,
    cacheTtlSeconds: Math.round(config.airQualityCacheTtlMs / 1000),
    staleTtlSeconds: Math.round(config.airQualityStaleTtlMs / 1000),
  });

  const routinesService = new RoutinesService({
    householdRepository,
    airQualityService,
    cacheRepository: deps.routinesCacheRepository ?? new RoutinesCacheRepository(),
  });

  const indoorAirService = new IndoorAirService({
    householdRepository,
    airQualityService,
    cacheRepository: deps.indoorCacheRepository ?? new IndoorCacheRepository(),
  });

  const alternativesService = new SustainableAlternativesService({
    householdRepository,
    airQualityService,
    cacheRepository: deps.alternativesCacheRepository ?? new AlternativesCacheRepository(),
  });

  const geminiClient = deps.geminiClient ?? new GoogleGenAIAdvisoryClient(config);
  const advisoryService = new AdvisoryService({
    householdRepository,
    routinesService,
    indoorAirService,
    alternativesService,
    geminiClient,
    cacheRepository: deps.advisoryCacheRepository ?? new AdvisoryCacheRepository(),
    metricsTracker: deps.advisoryMetricsTracker ?? new AdvisoryMetricsTracker(),
    ...(deps.advisoryTimeoutMs !== undefined ? { timeoutMs: deps.advisoryTimeoutMs } : {}),
  });

  const apiRouter = Router();
  apiRouter.use(attachRequestContext);
  apiRouter.use(requestLogger);
  apiRouter.use(createApiRateLimiter(config, deps.rateLimitMaxRequests));

  apiRouter.use(createHealthRouter(config));
  apiRouter.use('/auth', createAuthRouter({ config, tokenVerifier, roleResolver }));
  apiRouter.use(
    '/household',
    createHouseholdRouter({ tokenVerifier, roleResolver, householdRepository }),
  );
  apiRouter.use(
    '/air-quality',
    createAirQualityRouter({ tokenVerifier, roleResolver, airQualityService }),
  );
  apiRouter.use(
    '/routines',
    createRoutinesRouter({ tokenVerifier, roleResolver, routinesService }),
  );
  apiRouter.use(
    '/indoor-air',
    createIndoorRouter({ tokenVerifier, roleResolver, indoorAirService }),
  );
  apiRouter.use(
    '/alternatives',
    createAlternativesRouter({ tokenVerifier, roleResolver, alternativesService }),
  );
  apiRouter.use(
    '/advisory',
    createAdvisoryRouter({
      config,
      tokenVerifier,
      roleResolver,
      advisoryService,
      ...(deps.advisoryRateLimitMaxRequests !== undefined
        ? { rateLimitMaxRequests: deps.advisoryRateLimitMaxRequests }
        : {}),
    }),
  );
  apiRouter.use('/system', createSystemRouter({ tokenVerifier, roleResolver }));
  apiRouter.use(notFoundHandler);
  apiRouter.use(createErrorHandler(config.nodeEnv === 'production'));

  return apiRouter;
}

export function createApp(deps: ApiDependencies = {}): Express {
  const config = deps.config ?? loadConfig();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet(buildHelmetOptions(config.nodeEnv === 'production')));
  app.use(cors(buildCorsOptions(config)));
  app.use(express.json({ limit: '64kb' }));

  app.use('/api/v1', createApiRouter({ ...deps, config }));

  app.use(attachRequestContext);
  app.use(notFoundHandler);
  app.use(createErrorHandler(config.nodeEnv === 'production'));

  return app;
}
