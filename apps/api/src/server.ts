import 'dotenv/config';
import { createApp } from './app.ts';
import { loadConfig } from './config/env.ts';

const config = loadConfig();
const app = createApp({ config });

const server = app.listen(config.apiPort, '0.0.0.0', () => {
  console.info(
    JSON.stringify({
      level: 'info',
      service: 'urban-air-quality-api',
      message: `API server listening on port ${config.apiPort}`,
      environment: config.nodeEnv,
    }),
  );
});

function shutdown(signal: string): void {
  console.info(JSON.stringify({ level: 'info', message: `Received ${signal}, shutting down.` }));
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
