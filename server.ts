import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { loadConfig } from './apps/api/src/config/env.ts';
import { createProductionSpaRouter } from './apps/api/src/config/firebasePublicConfig.ts';
import { buildCorsOptions, buildHelmetOptions } from './apps/api/src/config/security.ts';
import { createApiRouter } from './apps/api/src/app.ts';
import cors from 'cors';
import helmet from 'helmet';

async function startUnifiedServer(): Promise<void> {
  const config = loadConfig();
  const app = express();
  const isProduction = config.nodeEnv === 'production';

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet(buildHelmetOptions(isProduction)));
  app.use(express.json({ limit: '64kb' }));

  app.use('/api/v1', cors(buildCorsOptions(config)), createApiRouter({ config }));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(createProductionSpaRouter(distDir, config.firebaseWebConfig));
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'urban-air-quality-assistant',
        message: `Unified AI Studio server listening on port ${config.port}`,
        environment: config.nodeEnv,
      }),
    );
  });

  const shutdown = (signal: string) => {
    console.info(JSON.stringify({ level: 'info', message: `Received ${signal}, shutting down.` }));
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startUnifiedServer().catch((err) => {
  console.error('Failed to start unified server:', err instanceof Error ? err.message : err);
  process.exit(1);
});
