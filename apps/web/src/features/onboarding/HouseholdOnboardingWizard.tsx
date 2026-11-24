import {
  householdLifestyleInputSchema,
  type HouseholdLifestyleInput,
  type HouseholdLifestyleRecord,
} from '@uaqa/contracts';
import { ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import {
  AlertBanner,
  Button,
  CheckboxField,
  FormField,
  SelectField,
  SurfaceCard,
} from '../../components/index.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import type { AuthUserSnapshot } from '../../lib/authService.ts';
import type { HouseholdStore } from '../../lib/householdStore.ts';
import { extractZodFieldErrors } from '../auth/validationHelpers.ts';
import {
  COMMUTE_MODE_OPTIONS,
  GUIDANCE_FOCUS_OPTIONS,
  HEATING_OPTIONS,
  HOUSEHOLD_COMPOSITION_OPTIONS,
  LOCATION_ZONE_OPTIONS,
  OUTDOOR_PATTERN_OPTIONS,
  REMINDER_CADENCE_OPTIONS,
  VENTILATION_OPTIONS,
  createInitialHouseholdDraft,
} from './options.ts';

export interface HouseholdOnboardingWizardProps {
  readonly user: AuthUserSnapshot;
  readonly initialProfile?: HouseholdLifestyleInput | null | undefined;
  readonly isEditingExisting?: boolean | undefined;
  readonly apiClient: WebApiClient;
  readonly householdStore: HouseholdStore;
  readonly onSaved: (record: HouseholdLifestyleRecord, completed: boolean) => void;
  readonly onCancelEdit?: (() => void) | undefined;
}

const step1Schema = householdLifestyleInputSchema.pick({
  country: true,
  city: true,
  neighborhood: true,
  postalPrefix: true,
  locationPreferences: true,
});

const step2Schema = householdLifestyleInputSchema.pick({
  householdSize: true,
  householdComposition: true,
  primaryCommuteMode: true,
  outdoorActivityPattern: true,
});

const step3Schema = householdLifestyleInputSchema.pick({
  ventilationContext: true,
  hasIndoorAirPurifier: true,
  heatingType: true,
  lifestylePreferences: true,
});

const STEP_TITLES = [
  'Location & Neighborhood Zone',
  'Household & Daily Routine',
  'Indoor Air & Guidance Preferences',
] as const;

type CompositionGroup = HouseholdLifestyleInput['householdComposition'][number];

export function HouseholdOnboardingWizard({
  user,
  initialProfile,
  isEditingExisting = false,
  apiClient,
  householdStore,
  onSaved,
  onCancelEdit,
}: HouseholdOnboardingWizardProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [draft, setDraft] = useState<HouseholdLifestyleInput>(() =>
    createInitialHouseholdDraft(initialProfile),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function validateStep(targetStep: 0 | 1 | 2): boolean {
    const schema = targetStep === 0 ? step1Schema : targetStep === 1 ? step2Schema : step3Schema;
    const result = schema.safeParse(draft);
    if (!result.success) {
      setFieldErrors(extractZodFieldErrors(result.error));
      return false;
    }
    setFieldErrors({});
    return true;
  }

  function handleNextStep() {
    setFormError(null);
    setDraftNotice(null);
    if (!validateStep(step)) {
      return;
    }
    setStep((prev) => (prev === 0 ? 1 : 2));
  }

  function handlePreviousStep() {
    setFormError(null);
    setDraftNotice(null);
    setFieldErrors({});
    setStep((prev) => (prev === 2 ? 1 : 0));
  }

  function toggleCompositionGroup(group: CompositionGroup, checked: boolean) {
    setDraft((prev) => {
      const next = checked
        ? Array.from(new Set([...prev.householdComposition, group]))
        : prev.householdComposition.filter((item) => item !== group);
      return {
        ...prev,
        householdComposition: next,
      };
    });
  }

  async function persistProfile(completed: boolean) {
    setFormError(null);
    setDraftNotice(null);

    const payloadCandidate: HouseholdLifestyleInput = {
      ...draft,
      onboardingCompleted: completed,
    };

    const parsed = householdLifestyleInputSchema.safeParse(payloadCandidate);
    if (!parsed.success) {
      setFieldErrors(extractZodFieldErrors(parsed.error));
      if (
        parsed.error.issues.some((i) =>
          ['country', 'city', 'neighborhood', 'postalPrefix', 'locationPreferences'].includes(
            String(i.path[0] ?? ''),
          ),
        )
      ) {
        setStep(0);
      } else if (
        parsed.error.issues.some((i) =>
          [
            'householdSize',
            'householdComposition',
            'primaryCommuteMode',
            'outdoorActivityPattern',
          ].includes(String(i.path[0] ?? '')),
        )
      ) {
        setStep(1);
      }
      return;
    }

    setFieldErrors({});
    setIsSaving(true);
    try {
      await apiClient.saveHouseholdProfile(parsed.data);
      const saved = await householdStore.saveHouseholdProfile(user.uid, parsed.data);
      if (!completed) {
        setDraftNotice(
          'Your household draft has been saved. You can sign out and resume onboarding later.',
        );
      }
      onSaved(saved, completed);
    } catch (error) {
      const msg =
        error instanceof z.ZodError
          ? 'Please review the highlighted household fields.'
          : error instanceof Error
            ? error.message
            : 'Unable to save household preferences right now.';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCompleteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateStep(2)) {
      return;
    }
    await persistProfile(true);
  }

  return (
    <SurfaceCard as="section" aria-labelledby="onboarding-heading" className="mx-auto max-w-3xl">
      <div className="space-y-2 border-b border-slate-200 pb-5">
        <p className="font-mono text-xs font-medium tracking-wide text-slate-600 uppercase">
          {isEditingExisting ? 'Update Household Context' : 'Step 3 · Household Onboarding'}
        </p>
        <h1 id="onboarding-heading" className="text-2xl font-bold tracking-tight text-slate-950">
          {isEditingExisting
            ? 'Edit household location & lifestyle preferences'
            : 'Set up your household air-quality profile'}
        </h1>
        <p className="text-sm leading-relaxed text-slate-700">
          These non-medical household preferences tailor future low-emission routines, indoor air
          tips, and smog alerts to your neighborhood without collecting personal health records.
        </p>
      </div>

      <nav aria-label="Onboarding steps" className="mt-5">
        <ol className="grid gap-2 sm:grid-cols-3">
          {STEP_TITLES.map((title, index) => {
            const isCurrent = step === index;
            const isDone = step > index;
            return (
              <li
                key={title}
                aria-current={isCurrent ? 'step' : undefined}
                className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                  isCurrent
                    ? 'border-[#0F5132] bg-emerald-50 font-semibold text-emerald-950'
                    : isDone
                      ? 'border-emerald-200 bg-white font-medium text-emerald-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <span className="font-mono block text-[11px] uppercase">
                  Step {index + 1} of 3 {isDone ? '· Done' : ''}
                </span>
                <span>{title}</span>
              </li>
            );
          })}
        </ol>
      </nav>

      {draftNotice ? (
        <div className="mt-5">
          <AlertBanner tone="success" title="Draft saved">
            <p>{draftNotice}</p>
          </AlertBanner>
        </div>
      ) : null}

      {formError ? (
        <div className="mt-5">
          <AlertBanner tone="error" title="Could not save household profile">
            <p>{formError}</p>
          </AlertBanner>
        </div>
      ) : null}

      <form onSubmit={handleCompleteSubmit} noValidate className="mt-6 space-y-6">
        {step === 0 ? (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-950">{STEP_TITLES[0]}</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="household-country"
                label="Country"
                required
                value={draft.country}
                onChange={(e) => setDraft((p) => ({ ...p, country: e.target.value }))}
                error={fieldErrors.country}
                placeholder="Poland"
              />

              <FormField
                id="household-city"
                label="City"
                required
                value={draft.city}
                onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))}
                error={fieldErrors.city}
                placeholder="Krakow"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="household-neighborhood"
                label="Neighborhood or district"
                required
                value={draft.neighborhood}
                onChange={(e) => setDraft((p) => ({ ...p, neighborhood: e.target.value }))}
                error={fieldErrors.neighborhood}
                placeholder="Krowodrza"
              />

              <FormField
                id="household-postal"
                label="Postal prefix"
                required
                value={draft.postalPrefix}
                onChange={(e) => setDraft((p) => ({ ...p, postalPrefix: e.target.value }))}
                error={fieldErrors.postalPrefix}
                hint="Prefix only (2–16 letters/digits) to avoid storing exact street addresses."
                placeholder="30-01"
              />
            </div>

            <SelectField
              id="household-zone-type"
              label="Local neighborhood corridor"
              required
              options={LOCATION_ZONE_OPTIONS}
              value={draft.locationPreferences.primaryZoneType}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  locationPreferences: {
                    ...p.locationPreferences,
                    primaryZoneType: e.target
                      .value as HouseholdLifestyleInput['locationPreferences']['primaryZoneType'],
                  },
                }))
              }
              error={fieldErrors['locationPreferences.primaryZoneType']}
            />

            <CheckboxField
              id="household-location-alerts"
              checked={draft.locationPreferences.alertsEnabled}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  locationPreferences: {
                    ...p.locationPreferences,
                    alertsEnabled: e.target.checked,
                  },
                }))
              }
              label="Enable winter smog alert advisories for this city"
              description="Matches community air-quality advisories for your neighborhood zone."
            />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-950">{STEP_TITLES[1]}</h2>

            <FormField
              id="household-size"
              label="Household size"
              type="number"
              min={1}
              max={20}
              required
              value={String(draft.householdSize)}
              onChange={(e) => {
                const parsedNum = Number.parseInt(e.target.value, 10);
                setDraft((p) => ({
                  ...p,
                  householdSize: Number.isNaN(parsedNum) ? 1 : parsedNum,
                }));
              }}
              error={fieldErrors.householdSize}
              hint="Total number of people living in your home (1 to 20)."
            />

            <fieldset className="space-y-2.5">
              <legend className="text-sm font-semibold text-slate-900">
                Household composition (non-medical planning groups)
                <span className="ml-1 text-red-700" aria-hidden="true">
                  *
                </span>
              </legend>
              <p className="text-xs text-slate-600">
                Select all age or household groups that shape daily outdoor routines.
              </p>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {HOUSEHOLD_COMPOSITION_OPTIONS.map((group) => (
                  <CheckboxField
                    key={group.value}
                    id={`composition-${group.value}`}
                    checked={draft.householdComposition.includes(group.value)}
                    onChange={(e) => toggleCompositionGroup(group.value, e.target.checked)}
                    label={group.label}
                    description={group.description}
                  />
                ))}
              </div>

              {fieldErrors.householdComposition ? (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {fieldErrors.householdComposition}
                </p>
              ) : null}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="household-commute"
                label="Primary commute mode"
                required
                options={COMMUTE_MODE_OPTIONS}
                value={draft.primaryCommuteMode}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    primaryCommuteMode: e.target
                      .value as HouseholdLifestyleInput['primaryCommuteMode'],
                  }))
                }
                error={fieldErrors.primaryCommuteMode}
              />

              <SelectField
                id="household-outdoor-pattern"
                label="Typical outdoor activity pattern"
                required
                options={OUTDOOR_PATTERN_OPTIONS}
                value={draft.outdoorActivityPattern}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    outdoorActivityPattern: e.target
                      .value as HouseholdLifestyleInput['outdoorActivityPattern'],
                  }))
                }
                error={fieldErrors.outdoorActivityPattern}
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-950">{STEP_TITLES[2]}</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="household-ventilation"
                label="Indoor ventilation context"
                required
                options={VENTILATION_OPTIONS}
                value={draft.ventilationContext}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    ventilationContext: e.target
                      .value as HouseholdLifestyleInput['ventilationContext'],
                  }))
                }
                error={fieldErrors.ventilationContext}
              />

              <SelectField
                id="household-heating"
                label="Primary home heating source"
                required
                options={HEATING_OPTIONS}
                value={draft.heatingType}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    heatingType: e.target.value as HouseholdLifestyleInput['heatingType'],
                  }))
                }
                error={fieldErrors.heatingType}
              />
            </div>

            <CheckboxField
              id="household-purifier"
              checked={draft.hasIndoorAirPurifier}
              onChange={(e) => setDraft((p) => ({ ...p, hasIndoorAirPurifier: e.target.checked }))}
              label="We have at least one HEPA indoor air purifier"
              description="Helps tailor indoor air circulation vs filter maintenance advice."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="household-guidance-focus"
                label="Preferred guidance focus"
                required
                options={GUIDANCE_FOCUS_OPTIONS}
                value={draft.lifestylePreferences.preferredGuidanceFocus}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    lifestylePreferences: {
                      ...p.lifestylePreferences,
                      preferredGuidanceFocus: e.target
                        .value as HouseholdLifestyleInput['lifestylePreferences']['preferredGuidanceFocus'],
                    },
                  }))
                }
              />

              <SelectField
                id="household-reminder-cadence"
                label="Routine reminder cadence"
                required
                options={REMINDER_CADENCE_OPTIONS}
                value={draft.lifestylePreferences.reminderCadence}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    lifestylePreferences: {
                      ...p.lifestylePreferences,
                      reminderCadence: e.target
                        .value as HouseholdLifestyleInput['lifestylePreferences']['reminderCadence'],
                    },
                  }))
                }
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0F5132]" aria-hidden="true" />
              <div>
                <p className="font-semibold text-slate-900">Privacy &amp; Data Separation Notice</p>
                <p className="mt-0.5">
                  Your household preferences are linked strictly to your verified account ID and
                  stored separately from your private email record. Only non-medical location zone
                  and lifestyle settings are persisted.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            {step > 0 ? (
              <Button type="button" variant="secondary" onClick={handlePreviousStep}>
                Previous step
              </Button>
            ) : null}

            {isEditingExisting && onCancelEdit ? (
              <Button type="button" variant="secondary" onClick={onCancelEdit}>
                Cancel editing
              </Button>
            ) : null}

            {!isEditingExisting ? (
              <Button
                type="button"
                variant="secondary"
                isLoading={isSaving}
                onClick={() => void persistProfile(false)}
              >
                Save draft &amp; resume later
              </Button>
            ) : null}
          </div>

          {step < 2 ? (
            <Button key="wizard-next-step" type="button" variant="primary" onClick={handleNextStep}>
              Continue to Step {step + 2}
            </Button>
          ) : (
            <Button key="wizard-submit" type="submit" variant="primary" isLoading={isSaving}>
              {isSaving
                ? 'Saving profile...'
                : isEditingExisting
                  ? 'Save updated preferences'
                  : 'Complete onboarding'}
            </Button>
          )}
        </div>
      </form>
    </SurfaceCard>
  );
}
