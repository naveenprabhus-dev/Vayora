import type { HouseholdLifestyleInput, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { createRoot } from 'react-dom/client';
import { App } from '../../src/app/App.tsx';
import type { AuthService, AuthUserSnapshot } from '../../src/lib/authService.ts';
import type { HouseholdStore } from '../../src/lib/householdStore.ts';
import '../../../../src/index.css';

let currentUser: AuthUserSnapshot | null = {
  uid: 'uid_e2e_family',
  email: 'elena@household.org',
  displayName: 'Elena Nowak',
  emailVerified: true,
};

let storedProfile: HouseholdLifestyleRecord = {
  ownerUid: 'uid_e2e_family',
  country: 'Poland',
  city: 'Krakow',
  neighborhood: 'Krowodrza',
  postalPrefix: '30-01',
  locationPreferences: {
    primaryZoneType: 'valley_basin',
    alertsEnabled: true,
  },
  householdSize: 4,
  householdComposition: ['adults', 'young_children'],
  primaryCommuteMode: 'public_transit',
  outdoorActivityPattern: 'school_run_family',
  ventilationContext: 'filtered_hvac_merv13',
  hasIndoorAirPurifier: true,
  heatingType: 'district',
  lifestylePreferences: {
    preferredGuidanceFocus: 'indoor_air',
    reminderCadence: 'daily_smog_alerts',
  },
  onboardingCompleted: true,
};

const authService: AuthService = {
  subscribeAuthState(onChange) {
    onChange(currentUser);
    return () => {};
  },
  async register() {
    if (!currentUser) {
      throw new Error('Not signed in');
    }
    return currentUser;
  },
  async login() {
    if (!currentUser) {
      throw new Error('Not signed in');
    }
    return currentUser;
  },
  async logout() {
    currentUser = null;
  },
  async resendVerificationEmail() {},
  async refreshCurrentUser() {
    return currentUser;
  },
  async getFreshIdToken() {
    return currentUser ? 'e2e-verified-firebase-token' : null;
  },
  async sendPasswordReset() {},
  async verifyResetCode() {},
  async confirmReset() {},
  async applyEmailVerificationCode() {},
};

const householdStore: HouseholdStore = {
  async syncVerifiedUserAccount() {},
  async getHouseholdProfile() {
    return storedProfile;
  },
  async saveHouseholdProfile(uid: string, input: HouseholdLifestyleInput) {
    storedProfile = { ownerUid: uid, ...input };
    return storedProfile;
  },
};

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App authService={authService} householdStore={householdStore} />);
}
