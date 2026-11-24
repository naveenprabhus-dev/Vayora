import type { HouseholdLifestyleRecord } from '@uaqa/contracts';

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
