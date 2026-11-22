import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/env.ts';

describe('API Health & Security Headers (Integration)', () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    GEMINI_API_KEY: 'AIzaSyFakeSecretMustNeverBeExposedInResponse',
  });
  const app = createApp({ config });

  it('returns standardized health response with security headers and zero secret exposure', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeTruthy();

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.service).toBe('urban-air-quality-api');
    expect(JSON.stringify(res.body)).not.toContain('AIzaSyFakeSecret');
  });

  it('returns standardized 404 envelope for unknown API routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
