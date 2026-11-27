import type { HouseholdLifestyleInput } from '@uaqa/contracts';
import type { Dispatch, SetStateAction } from 'react';
import { CheckboxField, FormField, SelectField } from '../../components/index.ts';
import { LOCATION_ZONE_OPTIONS } from './options.ts';

export interface OnboardingStepLocationProps {
  readonly title: string;
  readonly draft: HouseholdLifestyleInput;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly setDraft: Dispatch<SetStateAction<HouseholdLifestyleInput>>;
}

export function OnboardingStepLocation({
  title,
  draft,
  fieldErrors,
  setDraft,
}: OnboardingStepLocationProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>

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
  );
}
