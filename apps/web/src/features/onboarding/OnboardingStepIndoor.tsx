import type { HouseholdLifestyleInput } from '@uaqa/contracts';
import { ShieldCheck } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { CheckboxField, SelectField } from '../../components/index.ts';
import {
  GUIDANCE_FOCUS_OPTIONS,
  HEATING_OPTIONS,
  REMINDER_CADENCE_OPTIONS,
  VENTILATION_OPTIONS,
} from './options.ts';

export interface OnboardingStepIndoorProps {
  readonly title: string;
  readonly draft: HouseholdLifestyleInput;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly setDraft: Dispatch<SetStateAction<HouseholdLifestyleInput>>;
}

export function OnboardingStepIndoor({
  title,
  draft,
  fieldErrors,
  setDraft,
}: OnboardingStepIndoorProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>

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
            Your household preferences are linked strictly to your verified account ID and stored
            separately from your private email record. Only non-medical location zone and lifestyle
            settings are persisted.
          </p>
        </div>
      </div>
    </div>
  );
}
