import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.ts';

describe('loadConfig', () => {
  it('parses valid environment configuration and splits CORS origins', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '3000',
      API_PORT: '4000',
      APP_URL: 'https://example.org',
      CORS_ALLOWED_ORIGINS: 'https://example.org, https://app.example.org',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX_REQUESTS: '50',
      RATE_LIMIT_AUTH_MAX_REQUESTS: '10',
    });

    expect(config.nodeEnv).toBe('test');
    expect(config.corsAllowedOrigins).toEqual(['https://example.org', 'https://app.example.org']);
    expect(config.rateLimitMaxRequests).toBe(50);
  });

  it('includes APP_URL origin and local loopback origins when CORS_ALLOWED_ORIGINS is omitted', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '3000',
      APP_URL: 'https://preview.example.run.app/subpath',
    });

    expect(config.corsAllowedOrigins).toEqual([
      'https://preview.example.run.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });

  it('throws a clear error when environment variables violate constraints', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'invalid_env',
        PORT: '99999',
      }),
    ).toThrowError(/Invalid environment configuration/);
  });
});
