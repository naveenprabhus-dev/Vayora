import {
  householdLifestyleInputSchema,
  householdLifestyleRecordSchema,
  type HouseholdLifestyleInput,
  type HouseholdLifestyleRecord,
} from '@uaqa/contracts';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { AuthUserSnapshot } from './authService.ts';
import { OperationType, getFirestoreDb, handleFirestoreError } from './firebaseFirestore.ts';

export interface HouseholdStore {
  syncVerifiedUserAccount(user: AuthUserSnapshot, termsAcceptedAtIso?: string): Promise<void>;
  getHouseholdProfile(uid: string): Promise<HouseholdLifestyleRecord | null>;
  saveHouseholdProfile(
    uid: string,
    input: HouseholdLifestyleInput,
  ): Promise<HouseholdLifestyleRecord>;
}

export class FirestoreHouseholdStore implements HouseholdStore {
  public async syncVerifiedUserAccount(
    user: AuthUserSnapshot,
    termsAcceptedAtIso?: string,
  ): Promise<void> {
    if (!user.emailVerified) {
      return;
    }

    const db = getFirestoreDb();
    const userPath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);

    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName.slice(0, 80),
          role: 'regular_user',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const existingData = userSnap.data();
        if (existingData.displayName !== user.displayName.slice(0, 80)) {
          await updateDoc(userRef, {
            displayName: user.displayName.slice(0, 80),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }

    const privatePath = `users/${user.uid}/private/info`;
    const privateRef = doc(db, 'users', user.uid, 'private', 'info');

    try {
      const privateSnap = await getDoc(privateRef);
      if (!privateSnap.exists()) {
        const acceptedDate = termsAcceptedAtIso ? new Date(termsAcceptedAtIso) : new Date();
        await setDoc(privateRef, {
          uid: user.uid,
          email: user.email,
          termsAcceptedAt: Timestamp.fromDate(
            Number.isNaN(acceptedDate.getTime()) ? new Date() : acceptedDate,
          ),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const existingPrivate = privateSnap.data();
        if (existingPrivate.email !== user.email) {
          await updateDoc(privateRef, {
            email: user.email,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
  }

  public async getHouseholdProfile(uid: string): Promise<HouseholdLifestyleRecord | null> {
    const db = getFirestoreDb();
    const path = `households/${uid}`;
    try {
      const snap = await getDocs(
        query(collection(db, 'households'), where('ownerUid', '==', uid), limit(1)),
      );
      const firstDoc = snap.docs[0];
      if (!firstDoc || !firstDoc.exists()) {
        return null;
      }
      const data = firstDoc.data();
      const parsed = householdLifestyleRecordSchema.safeParse({
        ownerUid: data.ownerUid,
        country: data.country,
        city: data.city,
        neighborhood: data.neighborhood,
        postalPrefix: data.postalPrefix,
        locationPreferences: data.locationPreferences,
        householdSize: data.householdSize,
        householdComposition: data.householdComposition,
        primaryCommuteMode: data.primaryCommuteMode,
        outdoorActivityPattern: data.outdoorActivityPattern,
        ventilationContext: data.ventilationContext,
        hasIndoorAirPurifier: data.hasIndoorAirPurifier,
        heatingType: data.heatingType,
        lifestylePreferences: data.lifestylePreferences,
        onboardingCompleted: data.onboardingCompleted,
      });

      if (!parsed.success) {
        return null;
      }
      return parsed.data;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  public async saveHouseholdProfile(
    uid: string,
    input: HouseholdLifestyleInput,
  ): Promise<HouseholdLifestyleRecord> {
    const validated = householdLifestyleInputSchema.parse(input);
    const db = getFirestoreDb();
    const path = `households/${uid}`;
    const ref = doc(db, 'households', uid);

    try {
      const existingSnap = await getDocs(
        query(collection(db, 'households'), where('ownerUid', '==', uid), limit(1)),
      );
      if (existingSnap.empty) {
        await setDoc(ref, {
          ownerUid: uid,
          ...validated,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          ...validated,
          updatedAt: serverTimestamp(),
        });
      }

      return {
        ownerUid: uid,
        ...validated,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}
