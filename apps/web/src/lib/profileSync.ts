import type { HouseholdLifestyleInput, HouseholdLifestyleRecord } from '@uaqa/contracts';

/**
 * Produces a deterministic primitive fingerprint covering all household profile
 * fields that influence personalized routines, indoor guidance, alternatives,
 * and AI advisory context. Shared across workspaces to avoid duplicate effect logic.
 */
export function buildProfileSyncKey(profile: HouseholdLifestyleRecord): string {
  if (!profile.country || !profile.city) {
    return '';
  }

  return [
    profile.ownerUid,
    profile.country,
    profile.city,
    profile.neighborhood,
    profile.postalPrefix,
    profile.locationPreferences.primaryZoneType,
    String(profile.householdSize),
    profile.householdComposition.join(','),
    profile.primaryCommuteMode,
    profile.outdoorActivityPattern,
    profile.ventilationContext,
    String(profile.hasIndoorAirPurifier),
    profile.heatingType,
    profile.lifestylePreferences.preferredGuidanceFocus,
  ].join('|');
}

/**
 * Converts a persisted HouseholdLifestyleRecord into a mutable HouseholdLifestyleInput
 * payload with optional top-level field overrides for update mutations.
 */
export function toHouseholdLifestyleInput(
  profile: HouseholdLifestyleRecord,
  overrides: Partial<HouseholdLifestyleInput> = {},
): HouseholdLifestyleInput {
  return {
    country: profile.country,
    city: profile.city,
    neighborhood: profile.neighborhood,
    postalPrefix: profile.postalPrefix,
    locationPreferences: {
      primaryZoneType: profile.locationPreferences.primaryZoneType,
      alertsEnabled: profile.locationPreferences.alertsEnabled,
    },
    householdSize: profile.householdSize,
    householdComposition: [...profile.householdComposition],
    primaryCommuteMode: profile.primaryCommuteMode,
    outdoorActivityPattern: profile.outdoorActivityPattern,
    ventilationContext: profile.ventilationContext,
    hasIndoorAirPurifier: profile.hasIndoorAirPurifier,
    heatingType: profile.heatingType,
    lifestylePreferences: {
      preferredGuidanceFocus: profile.lifestylePreferences.preferredGuidanceFocus,
      reminderCadence: profile.lifestylePreferences.reminderCadence,
    },
    onboardingCompleted: profile.onboardingCompleted,
    ...overrides,
  };
}
