import type {
  AuthenticatedPrincipal,
  HouseholdLifestyleInput,
  HouseholdLifestyleRecord,
} from '@uaqa/contracts';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  AlertBanner,
  Button,
  CheckboxField,
  PageHeader,
  SelectField,
  SurfaceCard,
} from '../components/index.ts';
import {
  GUIDANCE_FOCUS_OPTIONS,
  REMINDER_CADENCE_OPTIONS,
} from '../features/onboarding/options.ts';
import type { WebApiClient } from '../lib/apiClient.ts';
import type { AuthService, AuthUserSnapshot } from '../lib/authService.ts';
import type { HouseholdStore } from '../lib/householdStore.ts';
import { toHouseholdLifestyleInput } from '../lib/profileSync.ts';

export interface SettingsPageProps {
  readonly user: AuthUserSnapshot;
  readonly principal: AuthenticatedPrincipal;
  readonly profile: HouseholdLifestyleRecord;
  readonly authService: AuthService;
  readonly apiClient: WebApiClient;
  readonly householdStore: HouseholdStore;
  readonly onProfileUpdated: (updated: HouseholdLifestyleRecord) => void;
  readonly onSignOut: () => Promise<void> | void;
  readonly onSessionIssue?: (error: unknown) => void;
}

export function SettingsPage({
  user,
  principal,
  profile,
  authService,
  apiClient,
  householdStore,
  onProfileUpdated,
  onSignOut,
  onSessionIssue,
}: SettingsPageProps) {
  const profilePrefsKey = `${profile.lifestylePreferences.preferredGuidanceFocus}|${profile.lifestylePreferences.reminderCadence}|${String(profile.locationPreferences.alertsEnabled)}`;
  const [draft, setDraft] = useState<{
    readonly baseKey: string;
    readonly preferredGuidanceFocus: HouseholdLifestyleInput['lifestylePreferences']['preferredGuidanceFocus'];
    readonly reminderCadence: HouseholdLifestyleInput['lifestylePreferences']['reminderCadence'];
    readonly alertsEnabled: boolean;
  } | null>(null);

  const activeDraft = draft && draft.baseKey === profilePrefsKey ? draft : null;
  const preferredGuidanceFocus =
    activeDraft?.preferredGuidanceFocus ?? profile.lifestylePreferences.preferredGuidanceFocus;
  const reminderCadence =
    activeDraft?.reminderCadence ?? profile.lifestylePreferences.reminderCadence;
  const alertsEnabled = activeDraft?.alertsEnabled ?? profile.locationPreferences.alertsEnabled;

  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsNotice, setPrefsNotice] = useState<string | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleSavePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingPrefs(true);
    setPrefsNotice(null);
    setPrefsError(null);

    const nextInput = toHouseholdLifestyleInput(profile, {
      locationPreferences: {
        primaryZoneType: profile.locationPreferences.primaryZoneType,
        alertsEnabled,
      },
      lifestylePreferences: {
        preferredGuidanceFocus,
        reminderCadence,
      },
    });

    try {
      await apiClient.saveHouseholdProfile(nextInput);
      const saved = await householdStore.saveHouseholdProfile(user.uid, nextInput);
      setDraft(null);
      onProfileUpdated(saved);
      setPrefsNotice('Guidance focus and smog alert settings have been saved.');
    } catch (error) {
      onSessionIssue?.(error);
      setPrefsError(
        error instanceof Error ? error.message : 'Unable to save guidance preferences right now.',
      );
    } finally {
      setIsSavingPrefs(false);
    }
  }

  async function handleRequestPasswordReset() {
    setIsSendingReset(true);
    setResetNotice(null);
    setResetError(null);
    try {
      await apiClient.requestPasswordResetAudit(user.email);
      await authService.sendPasswordReset(user.email);
      setResetNotice(`Password reset instructions have been sent to ${user.email}.`);
    } catch (error) {
      onSessionIssue?.(error);
      setResetError(
        error instanceof Error ? error.message : 'Unable to initiate password reset right now.',
      );
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="page-settings">
      <PageHeader
        kicker="Account & Preferences"
        title="Settings"
        description="Manage your guidance preferences, smog alert cadence, verified identity details, and session security."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard as="section" aria-labelledby="settings-preferences-heading">
          <form onSubmit={handleSavePreferences} className="space-y-5">
            <div className="border-b border-slate-200 pb-4">
              <h2
                id="settings-preferences-heading"
                className="text-lg font-semibold text-slate-950"
              >
                Guidance &amp; Alert Settings
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Customize how VAYORA prioritizes daily briefings, routine nudges, and winter smog
                advisories for {profile.city}.
              </p>
            </div>

            {prefsNotice ? (
              <AlertBanner tone="success" title="Settings saved">
                <p>{prefsNotice}</p>
              </AlertBanner>
            ) : null}

            {prefsError ? (
              <AlertBanner tone="error" title="Could not save settings">
                <p>{prefsError}</p>
              </AlertBanner>
            ) : null}

            <SelectField
              id="settings-guidance-focus"
              label="Preferred guidance focus"
              options={GUIDANCE_FOCUS_OPTIONS}
              value={preferredGuidanceFocus}
              onChange={(e) => {
                const nextFocus = e.target
                  .value as HouseholdLifestyleInput['lifestylePreferences']['preferredGuidanceFocus'];
                setDraft({
                  baseKey: profilePrefsKey,
                  preferredGuidanceFocus: nextFocus,
                  reminderCadence,
                  alertsEnabled,
                });
              }}
            />

            <SelectField
              id="settings-reminder-cadence"
              label="Routine reminder cadence"
              options={REMINDER_CADENCE_OPTIONS}
              value={reminderCadence}
              onChange={(e) => {
                const nextCadence = e.target
                  .value as HouseholdLifestyleInput['lifestylePreferences']['reminderCadence'];
                setDraft({
                  baseKey: profilePrefsKey,
                  preferredGuidanceFocus,
                  reminderCadence: nextCadence,
                  alertsEnabled,
                });
              }}
            />

            <CheckboxField
              id="settings-alerts-enabled"
              checked={alertsEnabled}
              onChange={(e) => {
                const nextAlerts = e.target.checked;
                setDraft({
                  baseKey: profilePrefsKey,
                  preferredGuidanceFocus,
                  reminderCadence,
                  alertsEnabled: nextAlerts,
                });
              }}
              label="Enable winter smog alert advisories"
              description={`Receive smog alerts aligned with ${profile.neighborhood}, ${profile.city}.`}
            />

            <div className="flex justify-end border-t border-slate-200 pt-4">
              <Button type="submit" variant="primary" isLoading={isSavingPrefs}>
                {isSavingPrefs ? 'Saving settings...' : 'Save settings'}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <div className="space-y-6">
          <SurfaceCard as="section" aria-labelledby="settings-account-heading">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4 text-[#0F5132]">
              <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
              <h2 id="settings-account-heading" className="text-lg font-semibold text-slate-950">
                Account Verification
              </h2>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-600">Display name</dt>
                <dd className="font-semibold text-slate-950">{user.displayName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">Verified email</dt>
                <dd className="font-mono text-slate-950">{principal.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">Access role</dt>
                <dd className="font-mono text-slate-950">{principal.role}</dd>
              </div>
            </dl>
          </SurfaceCard>

          <SurfaceCard as="section" aria-labelledby="settings-security-heading">
            <div className="border-b border-slate-200 pb-4">
              <h2 id="settings-security-heading" className="text-lg font-semibold text-slate-950">
                Password &amp; Session
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Request a password reset email or end your current authenticated session.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              {resetNotice ? (
                <AlertBanner tone="success" title="Password reset requested">
                  <p>{resetNotice}</p>
                </AlertBanner>
              ) : null}

              {resetError ? (
                <AlertBanner tone="error" title="Password reset unavailable">
                  <p>{resetError}</p>
                </AlertBanner>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={isSendingReset}
                  onClick={() => void handleRequestPasswordReset()}
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  {isSendingReset ? 'Sending reset link...' : 'Send password reset email'}
                </Button>

                <Button type="button" variant="secondary" onClick={() => void onSignOut()}>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
