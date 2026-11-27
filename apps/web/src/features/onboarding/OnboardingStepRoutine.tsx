import type { HouseholdLifestyleInput } from '@uaqa/contracts';
import type { Dispatch, SetStateAction } from 'react';
import { CheckboxField, FormField, SelectField } from '../../components/index.ts';
import {
  COMMUTE_MODE_OPTIONS,
  HOUSEHOLD_COMPOSITION_OPTIONS,
  OUTDOOR_PATTERN_OPTIONS,
} from './options.ts';

type CompositionGroup = HouseholdLifestyleInput['householdComposition'][number];

export interface OnboardingStepRoutineProps {
  readonly title: string;
  readonly draft: HouseholdLifestyleInput;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly setDraft: Dispatch<SetStateAction<HouseholdLifestyleInput>>;
  readonly onToggleCompositionGroup: (group: CompositionGroup, checked: boolean) => void;
}

export function OnboardingStepRoutine({
  title,
  draft,
  fieldErrors,
  setDraft,
  onToggleCompositionGroup,
}: OnboardingStepRoutineProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>

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
              onChange={(e) => onToggleCompositionGroup(group.value, e.target.checked)}
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
              primaryCommuteMode: e.target.value as HouseholdLifestyleInput['primaryCommuteMode'],
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
  );
}
