import {
  householdLifestyleInputSchema,
  type HouseholdLifestyleInput,
  type HouseholdLifestyleRecord,
} from '@uaqa/contracts';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { AlertBanner, Button, SurfaceCard } from '../../components/index.ts';
import type { WebApiClient } from '../../lib/apiClient.ts';
import type { AuthUserSnapshot } from '../../lib/authService.ts';
import { formatSafeUserError } from '../../lib/errorMessages.ts';
import type { HouseholdStore } from '../../lib/householdStore.ts';
import { extractZodFieldErrors } from '../auth/validationHelpers.ts';
import { OnboardingStepIndoor } from './OnboardingStepIndoor.tsx';
import { OnboardingStepLocation } from './OnboardingStepLocation.tsx';
import { OnboardingStepRoutine } from './OnboardingStepRoutine.tsx';
import { createInitialHouseholdDraft } from './options.ts';

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
          : formatSafeUserError(error, 'Unable to save household preferences right now.');
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
          <OnboardingStepLocation
            title={STEP_TITLES[0]}
            draft={draft}
            fieldErrors={fieldErrors}
            setDraft={setDraft}
          />
        ) : null}

        {step === 1 ? (
          <OnboardingStepRoutine
            title={STEP_TITLES[1]}
            draft={draft}
            fieldErrors={fieldErrors}
            setDraft={setDraft}
            onToggleCompositionGroup={toggleCompositionGroup}
          />
        ) : null}

        {step === 2 ? (
          <OnboardingStepIndoor
            title={STEP_TITLES[2]}
            draft={draft}
            fieldErrors={fieldErrors}
            setDraft={setDraft}
          />
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
