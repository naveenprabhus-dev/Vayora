import { deleteApp, getApps } from 'firebase/app';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RUNTIME_CONFIG_ELEMENT_ID,
  getFirebaseApp,
  getFirebaseAuth,
  isFirebaseClientConfigured,
  parseRuntimeFirebaseConfig,
  resetFirebaseClientAuthCacheForTests,
  resolveFirebaseClientConfig,
} from '../../src/lib/firebase.ts';
import {
  getFirestoreDb,
  resetFirestoreClientCacheForTests,
} from '../../src/lib/firebaseFirestore.ts';

function injectDomRuntimeConfig(rawText: string): void {
  const existing = document.getElementById(RUNTIME_CONFIG_ELEMENT_ID);
  if (existing) {
    existing.remove();
  }
  const script = document.createElement('script');
  script.id = RUNTIME_CONFIG_ELEMENT_ID;
  script.type = 'application/json';
  script.textContent = rawText;
  document.head.appendChild(script);
}

afterEach(async () => {
  const el = document.getElementById(RUNTIME_CONFIG_ELEMENT_ID);
  el?.remove();
  resetFirestoreClientCacheForTests();
  resetFirebaseClientAuthCacheForTests();
  await Promise.all(getApps().map((app) => deleteApp(app).catch(() => undefined)));
});

describe('Firebase Client Configuration Resolution & Singleton Initialization', () => {
  it('A. resolves build-time VITE_FIREBASE_* configuration when available', () => {
    const resolved = resolveFirebaseClientConfig({
      buildEnv: {
        VITE_FIREBASE_API_KEY: 'build-api-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'build-proj.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'build-proj',
        VITE_FIREBASE_APP_ID: '1:100:web:build',
        VITE_FIREBASE_STORAGE_BUCKET: 'build-proj.appspot.com',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '100',
        VITE_FIREBASE_DATABASE_ID: 'build-db',
      },
      runtimeRawJson: null,
      appletConfig: {},
    });

    expect(resolved).toEqual({
      apiKey: 'build-api-key',
      authDomain: 'build-proj.firebaseapp.com',
      projectId: 'build-proj',
      appId: '1:100:web:build',
      storageBucket: 'build-proj.appspot.com',
      messagingSenderId: '100',
      databaseId: 'build-db',
    });
    expect(
      isFirebaseClientConfigured({
        buildEnv: {
          VITE_FIREBASE_API_KEY: 'build-api-key',
          VITE_FIREBASE_PROJECT_ID: 'build-proj',
          VITE_FIREBASE_APP_ID: '1:100:web:build',
        },
        runtimeRawJson: null,
        appletConfig: {},
      }),
    ).toBe(true);
  });

  it('B. resolves server-provided DOM runtime configuration when build-time env is absent', () => {
    injectDomRuntimeConfig(
      JSON.stringify({
        apiKey: 'runtime-api-key',
        authDomain: 'runtime-proj.firebaseapp.com',
        projectId: 'runtime-proj',
        appId: '1:200:web:runtime',
        storageBucket: 'runtime-proj.appspot.com',
        messagingSenderId: '200',
        databaseId: 'runtime-db',
      }),
    );

    const resolved = resolveFirebaseClientConfig({
      buildEnv: {},
      appletConfig: {},
    });

    expect(resolved).toEqual({
      apiKey: 'runtime-api-key',
      authDomain: 'runtime-proj.firebaseapp.com',
      projectId: 'runtime-proj',
      appId: '1:200:web:runtime',
      storageBucket: 'runtime-proj.appspot.com',
      messagingSenderId: '200',
      databaseId: 'runtime-db',
    });
    expect(
      isFirebaseClientConfigured({
        buildEnv: {},
        appletConfig: {},
      }),
    ).toBe(true);
  });

  it('C. prioritizes build-time > runtime > firebase-applet-config.json when multiple sources exist', () => {
    const resolved = resolveFirebaseClientConfig({
      buildEnv: {
        VITE_FIREBASE_API_KEY: 'build-key-wins',
        VITE_FIREBASE_PROJECT_ID: 'build-project-wins',
      },
      runtimeRawJson: JSON.stringify({
        apiKey: 'runtime-key-overridden',
        authDomain: 'runtime-domain-wins.firebaseapp.com',
        projectId: 'runtime-project-overridden',
        appId: '1:300:web:runtime-app-wins',
        databaseId: 'runtime-db-wins',
      }),
      appletConfig: {
        apiKey: 'applet-key-lowest',
        authDomain: 'applet-domain-lowest.firebaseapp.com',
        projectId: 'applet-project-lowest',
        appId: '1:400:web:applet-app',
        storageBucket: 'applet-bucket-fallback.appspot.com',
        messagingSenderId: '400',
        firestoreDatabaseId: 'applet-db-lowest',
      },
    });

    expect(resolved).toEqual({
      apiKey: 'build-key-wins',
      authDomain: 'runtime-domain-wins.firebaseapp.com',
      projectId: 'build-project-wins',
      appId: '1:300:web:runtime-app-wins',
      storageBucket: 'applet-bucket-fallback.appspot.com',
      messagingSenderId: '400',
      databaseId: 'runtime-db-wins',
    });
  });

  it('D. returns false from isFirebaseClientConfigured() when mandatory fields are missing or placeholders', () => {
    expect(
      isFirebaseClientConfigured({
        buildEnv: {
          VITE_FIREBASE_API_KEY: 'key-only',
          VITE_FIREBASE_PROJECT_ID: 'proj-only',
        },
        runtimeRawJson: null,
        appletConfig: {},
      }),
    ).toBe(false);

    expect(
      isFirebaseClientConfigured({
        buildEnv: {
          VITE_FIREBASE_API_KEY: 'REPLACE_WITH_KEY',
          VITE_FIREBASE_PROJECT_ID: 'proj-id',
          VITE_FIREBASE_APP_ID: '1:1:web:1',
        },
        runtimeRawJson: null,
        appletConfig: {},
      }),
    ).toBe(false);
  });

  it('E. safely ignores malformed or polluted runtime configuration without throwing', () => {
    expect(parseRuntimeFirebaseConfig('{malformed-json')).toEqual({});
    expect(parseRuntimeFirebaseConfig('["not-an-object"]')).toEqual({});
    expect(
      parseRuntimeFirebaseConfig(
        JSON.stringify({
          apiKey: 12345,
          projectId: 'valid-proj',
          geminiApiKey: 'should-be-dropped',
          __proto__: { polluted: true },
        }),
      ),
    ).toEqual({
      projectId: 'valid-proj',
    });

    injectDomRuntimeConfig('{broken json');
    expect(
      isFirebaseClientConfigured({
        buildEnv: {},
        appletConfig: {},
      }),
    ).toBe(false);
  });

  it('G & H. initializes Firebase once and shares identical project config across Auth and Firestore', () => {
    injectDomRuntimeConfig(
      JSON.stringify({
        apiKey: 'AIzaSyTestRuntimeKeyForSingleton0001',
        authDomain: 'shared-singleton-proj.firebaseapp.com',
        projectId: 'shared-singleton-proj',
        appId: '1:555000:web:singleton01',
        storageBucket: 'shared-singleton-proj.appspot.com',
        messagingSenderId: '555000',
        databaseId: 'custom-named-db',
      }),
    );

    const app1 = getFirebaseApp();
    const app2 = getFirebaseApp();
    const auth = getFirebaseAuth();
    const db = getFirestoreDb();

    expect(app1).toBe(app2);
    expect(getApps()).toHaveLength(1);
    expect(auth.app).toBe(app1);
    expect(db.app).toBe(app1);
    expect(auth.app.options.projectId).toBe('shared-singleton-proj');
    expect(db.app.options.projectId).toBe('shared-singleton-proj');
    expect(db.app.options.appId).toBe('1:555000:web:singleton01');
  });

  it('I. verifies firebase.ts and firebaseFirestore.ts ES module exports link cleanly without mismatches', async () => {
    const firebaseMod = await import('../../src/lib/firebase.ts');
    const firestoreMod = await import('../../src/lib/firebaseFirestore.ts');
    const householdMod = await import('../../src/lib/householdStore.ts');

    expect(typeof firebaseMod.resolveFirebaseClientConfig).toBe('function');
    expect(typeof firebaseMod.isFirebaseClientConfigured).toBe('function');
    expect(typeof firebaseMod.getFirebaseApp).toBe('function');
    expect(typeof firebaseMod.getFirebaseAuth).toBe('function');
    expect(typeof firestoreMod.getFirestoreDb).toBe('function');
    expect(typeof firestoreMod.testFirestoreConnection).toBe('function');
    expect(typeof firestoreMod.handleFirestoreError).toBe('function');
    expect(typeof householdMod.FirestoreHouseholdStore).toBe('function');
  });
});
