import type { AuthenticatedPrincipal, HouseholdLifestyleRecord } from '@uaqa/contracts';
import { CheckCircle2, Pencil } from 'lucide-react';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import type { AuthUserSnapshot } from '../../lib/authService.ts';
import {
  COMMUTE_MODE_OPTIONS,
  GUIDANCE_FOCUS_OPTIONS,
  HEATING_OPTIONS,
  HOUSEHOLD_COMPOSITION_OPTIONS,
  LOCATION_ZONE_OPTIONS,
  OUTDOOR_PATTERN_OPTIONS,
  REMINDER_CADENCE_OPTIONS,
  VENTILATION_OPTIONS,
  findOptionLabel,
} from './options.ts';

export interface VerifiedProfileSummaryProps {
  readonly user: AuthUserSnapshot;
  readonly principal: AuthenticatedPrincipal;
  readonly profile: HouseholdLifestyleRecord;
  readonly statusMessage?: string | undefined;
  readonly onEditProfile: () => void;
}

export function VerifiedProfileSummary({
  user,
  principal,
  profile,
  statusMessage,
  onEditProfile,
}: VerifiedProfileSummaryProps) {
  const compositionLabels = profile.householdComposition
    .map((code) => HOUSEHOLD_COMPOSITION_OPTIONS.find((item) => item.value === code)?.label ?? code)
    .join(', ');

  return (
    <div className="space-y-6">
      <section aria-labelledby="account-ready-heading" className="space-y-2">
        <p className="font-mono text-xs font-medium tracking-wide text-slate-600 uppercase">
          Phase 1 Complete · Verified Household Workspace
        </p>
        <h1 id="account-ready-heading" className="text-3xl font-bold tracking-tight text-slate-950">
          Welcome, {user.displayName}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-700">
          Your email address is verified and your household location and lifestyle profile is saved
          under strict server-verified ownership rules.
        </p>
      </section>

      {statusMessage ? (
        <AlertBanner tone="success" title="Household profile updated">
          <p>{statusMessage}</p>
        </AlertBanner>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <SurfaceCard as="section" aria-labelledby="identity-summary-heading">
          <div className="flex items-center gap-2 text-[#0F5132]">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <h2 id="identity-summary-heading" className="text-lg font-semibold text-slate-950">
              Verified Identity
            </h2>
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-600">Account email</dt>
              <dd className="font-mono text-slate-950">{principal.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-600">Verification state</dt>
              <dd className="font-semibold text-[#0F5132]">Server-verified email</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-600">Assigned access role</dt>
              <dd className="font-mono text-slate-950">{principal.role}</dd>
            </div>
          </dl>
        </SurfaceCard>

        <SurfaceCard
          as="section"
          aria-labelledby="household-summary-heading"
          className="lg:col-span-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 id="household-summary-heading" className="text-lg font-semibold text-slate-950">
                Household Location &amp; Lifestyle Preferences
              </h2>
              <p className="text-xs text-slate-600">
                Saved for {profile.city}, {profile.country} ({profile.neighborhood})
              </p>
            </div>

            <Button type="button" variant="secondary" onClick={onEditProfile}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit preferences
            </Button>
          </div>

          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-600">Location &amp; postal prefix</dt>
              <dd className="font-medium text-slate-950">
                {profile.neighborhood}, {profile.city}, {profile.country} (
                <span className="font-mono">{profile.postalPrefix}</span>)
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-600">Neighborhood corridor</dt>
              <dd className="font-medium text-slate-950">
                {findOptionLabel(
                  LOCATION_ZONE_OPTIONS,
                  profile.locationPreferences.primaryZoneType,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-600">Household size &amp; groups</dt>
              <dd className="font-medium text-slate-950">
                {profile.householdSize} member{profile.householdSize === 1 ? '' : 's'} ·{' '}
                {compositionLabels}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-600">Commute &amp; outdoor routine</dt>
              <dd className="font-medium text-slate-950">
                {findOptionLabel(COMMUTE_MODE_OPTIONS, profile.primaryCommuteMode)} ·{' '}
                {findOptionLabel(OUTDOOR_PATTERN_OPTIONS, profile.outdoorActivityPattern)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-600">Ventilation &amp; heating</dt>
              <dd className="font-medium text-slate-950">
                {findOptionLabel(VENTILATION_OPTIONS, profile.ventilationContext)} ·{' '}
                {findOptionLabel(HEATING_OPTIONS, profile.heatingType)} ·{' '}
                {profile.hasIndoorAirPurifier ? 'HEPA purifier installed' : 'No HEPA purifier'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-600">Guidance &amp; alert cadence</dt>
              <dd className="font-medium text-slate-950">
                {findOptionLabel(
                  GUIDANCE_FOCUS_OPTIONS,
                  profile.lifestylePreferences.preferredGuidanceFocus,
                )}{' '}
                ·{' '}
                {findOptionLabel(
                  REMINDER_CADENCE_OPTIONS,
                  profile.lifestylePreferences.reminderCadence,
                )}
              </dd>
            </div>
          </dl>
        </SurfaceCard>
      </div>

      <AlertBanner tone="info" title="Module Roadmap Status">
        <p>
          Phase 1 authentication, RBAC boundaries, and household onboarding are active. Live AQI
          telemetry, low-emission daily routines, indoor guidance, and Gemini-powered explanations
          will connect to this verified household context in Phase 2+.
        </p>
      </AlertBanner>
    </div>
  );
}
