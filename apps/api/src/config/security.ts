import type { CorsOptions } from 'cors';
import type { HelmetOptions } from 'helmet';
import type { AppConfig } from './env.ts';

export function buildHelmetOptions(isProduction: boolean): HelmetOptions {
  return {
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: [
              "'self'",
              'https://identitytoolkit.googleapis.com',
              'https://securetoken.googleapis.com',
              'https://firestore.googleapis.com',
              'https://www.googleapis.com',
            ],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  };
}

export function buildCorsOptions(config: AppConfig): CorsOptions {
  const allowlist = new Set(config.corsAllowedOrigins);

  return {
    origin(origin, callback) {
      if (!origin) {
        // Same-origin or non-browser server-to-server requests
        callback(null, true);
        return;
      }
      if (allowlist.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS policy'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    credentials: true,
    maxAge: 600,
  };
}
