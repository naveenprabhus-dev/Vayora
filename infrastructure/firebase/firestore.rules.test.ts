import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const rulesPath = path.resolve(import.meta.dirname, '../../firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

function validHouseholdPayload(ownerUid: string) {
  return {
    ownerUid,
    country: 'Poland',
    city: 'Warsaw',
    neighborhood: 'Mokotow',
    postalPrefix: '02-5',
    locationPreferences: {
      primaryZoneType: 'urban_core',
      alertsEnabled: true,
    },
    householdSize: 3,
    householdComposition: ['adults', 'young_children'],
    primaryCommuteMode: 'public_transit',
    outdoorActivityPattern: 'school_run_family',
    ventilationContext: 'filtered_hvac_merv13',
    hasIndoorAirPurifier: true,
    heatingType: 'district',
    lifestylePreferences: {
      preferredGuidanceFocus: 'balanced',
      reminderCadence: 'daily_smog_alerts',
    },
    onboardingCompleted: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

describe('Firestore Security Rules (Adversarial Dirty Dozen & Ownership)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'uaqa-rules-test',
      firestore: {
        rules: rulesContent,
        host: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] ?? '127.0.0.1',
        port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] ?? '8080'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('1. denies unauthenticated guest read and write on households', async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(guestDb, 'households', 'user_a')));
    await assertFails(
      setDoc(doc(guestDb, 'households', 'user_a'), validHouseholdPayload('user_a')),
    );
  });

  it('2. denies unverified authenticated user from creating user account or household', async () => {
    const unverifiedDb = testEnv
      .authenticatedContext('user_unverified', {
        email: 'pending@example.org',
        email_verified: false,
      })
      .firestore();

    await assertFails(
      setDoc(doc(unverifiedDb, 'users', 'user_unverified'), {
        uid: 'user_unverified',
        displayName: 'Pending User',
        role: 'regular_user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      setDoc(
        doc(unverifiedDb, 'households', 'user_unverified'),
        validHouseholdPayload('user_unverified'),
      ),
    );
  });

  it('3. denies privilege escalation on user registration (role != regular_user)', async () => {
    const db = testEnv
      .authenticatedContext('user_a', { email: 'a@example.org', email_verified: true })
      .firestore();

    await assertFails(
      setDoc(doc(db, 'users', 'user_a'), {
        uid: 'user_a',
        displayName: 'User A',
        role: 'admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('4. denies role tampering on user update', async () => {
    const db = testEnv
      .authenticatedContext('user_a', { email: 'a@example.org', email_verified: true })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, 'users', 'user_a'), {
        uid: 'user_a',
        displayName: 'User A',
        role: 'regular_user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      updateDoc(doc(db, 'users', 'user_a'), {
        role: 'community_coordinator',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('5. denies shadow field injection on household create', async () => {
    const db = testEnv
      .authenticatedContext('user_a', { email: 'a@example.org', email_verified: true })
      .firestore();

    await assertFails(
      setDoc(doc(db, 'households', 'user_a'), {
        ...validHouseholdPayload('user_a'),
        isPremium: true,
      }),
    );
  });

  it('6. denies cross-tenant PII read on /users/{other}/private/info', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'user_victim', 'private', 'info'), {
        uid: 'user_victim',
        email: 'victim@example.org',
        termsAcceptedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const attackerDb = testEnv
      .authenticatedContext('user_attacker', {
        email: 'attacker@example.org',
        email_verified: true,
      })
      .firestore();

    await assertFails(getDoc(doc(attackerDb, 'users', 'user_victim', 'private', 'info')));
  });

  it('7. denies cross-tenant household write and mismatched householdId', async () => {
    const attackerDb = testEnv
      .authenticatedContext('user_attacker', {
        email: 'attacker@example.org',
        email_verified: true,
      })
      .firestore();

    await assertFails(
      setDoc(doc(attackerDb, 'households', 'user_victim'), validHouseholdPayload('user_victim')),
    );
    await assertFails(
      setDoc(doc(attackerDb, 'households', 'user_attacker'), validHouseholdPayload('user_victim')),
    );
  });

  it('8. denies oversized or malformed IDs and client-spoofed timestamps', async () => {
    const db = testEnv
      .authenticatedContext('user_a', { email: 'a@example.org', email_verified: true })
      .firestore();

    await assertFails(
      setDoc(doc(db, 'households', 'a'.repeat(130)), validHouseholdPayload('user_a')),
    );

    await assertFails(
      setDoc(doc(db, 'households', 'user_a'), {
        ...validHouseholdPayload('user_a'),
        createdAt: new Date('2020-01-01T00:00:00Z'),
      }),
    );
  });

  it('9. denies email spoof attempt against admin privilege when email_verified is false', async () => {
    const spoofAdminDb = testEnv
      .authenticatedContext('spoof_admin', {
        email: 'naveenprabhuvitap@gmail.com',
        email_verified: false,
      })
      .firestore();

    await assertFails(getDoc(doc(spoofAdminDb, 'users', 'user_a')));
  });

  it('10. allows verified owner to create and update their own user, private PII, and household profile', async () => {
    const db = testEnv
      .authenticatedContext('user_owner', { email: 'owner@example.org', email_verified: true })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, 'users', 'user_owner'), {
        uid: 'user_owner',
        displayName: 'Owner Name',
        role: 'regular_user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(
      setDoc(doc(db, 'users', 'user_owner', 'private', 'info'), {
        uid: 'user_owner',
        email: 'owner@example.org',
        termsAcceptedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(
      setDoc(doc(db, 'households', 'user_owner'), validHouseholdPayload('user_owner')),
    );

    await assertSucceeds(
      updateDoc(doc(db, 'households', 'user_owner'), {
        city: 'Krakow',
        updatedAt: serverTimestamp(),
      }),
    );
  });
});
