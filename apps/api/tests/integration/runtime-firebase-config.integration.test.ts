import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.ts';
import {
  RUNTIME_CONFIG_ELEMENT_ID,
  buildPublicFirebaseClientConfig,
  createProductionSpaRouter,
  injectPublicFirebaseConfigIntoHtml,
} from '../../src/config/firebasePublicConfig.ts';
import { buildHelmetOptions } from '../../src/config/security.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('F. Production Runtime Firebase Config Security & Injection (Integration)', () => {
  it('allowlists only public Firebase fields and excludes all backend secrets', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '3000',
      APP_URL: 'https://vayora.example.org',
      GEMINI_API_KEY: 'super-secret-gemini-key-123',
      AIR_QUALITY_API_KEY: 'secret-aq-key-456',
      ADMIN_EMAILS: 'admin@example.org',
      COORDINATOR_EMAILS: 'coord@example.org',
      FIREBASE_PROJECT_ID: 'prod-project-id',
      VITE_FIREBASE_API_KEY: 'public-web-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'prod-project-id.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'prod-project-id',
      VITE_FIREBASE_APP_ID: '1:999:web:abc123',
      VITE_FIREBASE_STORAGE_BUCKET: 'prod-project-id.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '999',
      VITE_FIREBASE_DATABASE_ID: 'prod-named-db',
    });

    expect(config.firebaseWebConfig).toEqual({
      apiKey: 'public-web-api-key',
      authDomain: 'prod-project-id.firebaseapp.com',
      projectId: 'prod-project-id',
      appId: '1:999:web:abc123',
      storageBucket: 'prod-project-id.appspot.com',
      messagingSenderId: '999',
      databaseId: 'prod-named-db',
    });

    const directAllowlist = buildPublicFirebaseClientConfig({
      VITE_FIREBASE_API_KEY: 'public-web-api-key',
      GEMINI_API_KEY: 'must-never-appear',
      GOOGLE_APPLICATION_CREDENTIALS: '/secret/sa.json',
      PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----',
    });
    expect(directAllowlist).toEqual({ apiKey: 'public-web-api-key' });
    expect(JSON.stringify(directAllowlist)).not.toContain('must-never-appear');
    expect(JSON.stringify(directAllowlist)).not.toContain('PRIVATE KEY');
  });

  it('serves production dist/index.html with safely serialized runtime config, zero backend secrets, and intact Helmet CSP', async () => {
    const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'vayora-dist-'));
    tempDirs.push(tmpDist);
    fs.mkdirSync(path.join(tmpDist, 'assets'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDist, 'index.html'),
      `<!doctype html><html><head><title>VAYORA</title><script type="module" src="/assets/index.js"></script></head><body><div id="root"></div></body></html>`,
      'utf8',
    );
    fs.writeFileSync(path.join(tmpDist, 'assets', 'index.js'), 'console.log("ok");', 'utf8');

    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '3000',
      APP_URL: 'https://vayora.example.org',
      GEMINI_API_KEY: 'secret-gemini-never-in-html',
      AIR_QUALITY_API_KEY: 'secret-aq-never-in-html',
      ADMIN_EMAILS: 'admin-secret@example.org',
      FIREBASE_PROJECT_ID: 'prod-project-id',
      VITE_FIREBASE_API_KEY: 'public-web-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'prod-project-id.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'prod-project-id',
      VITE_FIREBASE_APP_ID: '1:999:web:abc123',
      VITE_FIREBASE_DATABASE_ID: 'prod-named-db',
    });

    const app = express();
    app.use(helmet(buildHelmetOptions(true)));
    app.use(createProductionSpaRouter(tmpDist, config.firebaseWebConfig));

    const res = await request(app).get('/').expect(200);
    const cspHeader = String(res.headers['content-security-policy'] ?? '');
    const scriptSrcDirective = cspHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('script-src '));
    expect(scriptSrcDirective).toBe("script-src 'self'");
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).toContain(`id="${RUNTIME_CONFIG_ELEMENT_ID}" type="application/json"`);
    expect(res.text).not.toContain('secret-gemini-never-in-html');
    expect(res.text).not.toContain('secret-aq-never-in-html');
    expect(res.text).not.toContain('admin-secret@example.org');

    const match = res.text.match(
      /<script id="vayora-runtime-config" type="application\/json">([\s\S]*?)<\/script>/,
    );
    expect(match?.[1]).toBeTruthy();
    const parsedRuntime = JSON.parse(match?.[1] ?? '{}');
    expect(parsedRuntime).toEqual({
      apiKey: 'public-web-api-key',
      authDomain: 'prod-project-id.firebaseapp.com',
      projectId: 'prod-project-id',
      appId: '1:999:web:abc123',
      databaseId: 'prod-named-db',
    });

    // Also verifies SPA subpaths serve injected HTML while static JS assets serve directly
    const spaRes = await request(app).get('/register').expect(200);
    expect(spaRes.text).toContain(`id="${RUNTIME_CONFIG_ELEMENT_ID}"`);

    const assetRes = await request(app).get('/assets/index.js').expect(200);
    expect(assetRes.text).toContain('console.log("ok")');
  });

  it('escapes HTML and script breakout characters when serializing runtime config', () => {
    const html = '<html><head></head><body></body></html>';
    const injected = injectPublicFirebaseConfigIntoHtml(html, {
      apiKey: '</script><script>alert(1)</script>',
      projectId: 'proj&test',
      appId: '1:1:web:1',
    });

    expect(injected).not.toContain('</script><script>');
    expect(injected).toContain('\\u003c/script\\u003e\\u003cscript\\u003ealert(1)');
    expect(injected).toContain('proj\\u0026test');
  });
});
