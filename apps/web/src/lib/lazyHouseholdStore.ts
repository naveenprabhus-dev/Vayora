import type { HouseholdStore } from './householdStore.ts';

/**
 * Defers importing firebase/firestore and HouseholdStore implementation
 * until an authenticated, email-verified user actually enters onboarding or workspace.
 */
export function createLazyFirestoreStore(): HouseholdStore {
  let storePromise: Promise<HouseholdStore> | null = null;
  const loadStore = (): Promise<HouseholdStore> => {
    if (!storePromise) {
      storePromise = import('./householdStore.ts').then(
        (mod) => new mod.FirestoreHouseholdStore(),
      );
    }
    return storePromise;
  };

  return {
    async syncVerifiedUserAccount(user, termsAcceptedAtIso) {
      const store = await loadStore();
      return store.syncVerifiedUserAccount(user, termsAcceptedAtIso);
    },
    async getHouseholdProfile(uid) {
      const store = await loadStore();
      return store.getHouseholdProfile(uid);
    },
    async saveHouseholdProfile(uid, input) {
      const store = await loadStore();
      return store.saveHouseholdProfile(uid, input);
    },
  };
}
