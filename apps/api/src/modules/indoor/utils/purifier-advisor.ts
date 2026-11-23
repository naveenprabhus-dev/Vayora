import type {
  AirPurifierGuidanceSummary,
  HouseholdLifestyleRecord,
  IndoorScenarioId,
} from '@uaqa/contracts';
import type { EvaluatedAirQualityState } from '../../routines/routines.types.ts';

export function buildAirPurifierGuidance(options: {
  readonly profile: HouseholdLifestyleRecord;
  readonly aqState: EvaluatedAirQualityState;
  readonly scenario: IndoorScenarioId;
}): AirPurifierGuidanceSummary {
  const { profile, aqState, scenario } = options;

  const hasSavedPurifier =
    profile.hasIndoorAirPurifier || profile.ventilationContext === 'portable_hepa_only';
  const scenarioSimulatedPurifier = !hasSavedPurifier && scenario === 'operating_purifier';
  const showPurifierOperatingGuidance = hasSavedPurifier || scenarioSimulatedPurifier;

  const gasAndVocLimitation =
    'Standard HEPA filters capture airborne particles (such as fine PM2.5, smoke soot, dust, and pollen), but HEPA media alone does not remove gaseous pollutants such as carbon monoxide (CO), nitrogen dioxide (NO2), or all volatile organic compounds (VOCs) from cleaning chemicals or gas stoves.';

  if (showPurifierOperatingGuidance) {
    const isHighPollution = aqState.isHighOrWorse || scenario === 'elevated_outdoor_pollution';
    const placementNote =
      scenario === 'cooking'
        ? 'Keep a portable purifier clear of direct kitchen grease steam, which can coat pre-filters rapidly; rely on range exhaust and lid usage at the stove first.'
        : 'Position the unit in a regularly occupied room (such as a living room or bedroom) with clear intake and exhaust space away from walls or curtains.';

    return {
      hasPurifier: hasSavedPurifier,
      scenarioSimulatedPurifier,
      headline: scenarioSimulatedPurifier
        ? 'Simulated Guidance: Operating a Portable HEPA Air Purifier'
        : isHighPollution
          ? 'Operate your HEPA air purifier consistently during elevated outdoor particles'
          : 'Maintain targeted HEPA particle filtration alongside source control',
      summary: scenarioSimulatedPurifier
        ? 'Your saved profile does not list an indoor purifier, so this panel illustrates practical usage and limitations if you operate one.'
        : 'Guidance tailored to your household reporting an indoor air purifier or filtered ventilation setup, focused on practical operation and realistic particle-only limits.',
      practicalGuidance: [
        'Run the purifier steadily at an appropriate fan speed for the occupied room rather than expecting brief bursts to clear persistent sources; lower night settings can balance noise and continuous particle capture.',
        placementNote,
        'Check room-size suitability against the unit manufacturer ratings (such as CADR / recommended room area); one portable unit typically serves a single enclosed space rather than an entire multi-room home.',
        'Keep exterior doors and windows closed when relying on the purifier during elevated outdoor smog so un-filtered outdoor air does not continuously dilute filtered room air—except when essential ventilation is needed for combustion or chemical fumes.',
        'Inspect pre-filters regularly for dust buildup and replace HEPA filters on the schedule specified by your manufacturer; do not wash non-washable HEPA media.',
      ],
      gasAndVocLimitation,
      nonPurchaseNote: scenarioSimulatedPurifier
        ? 'Simulated view: owning a purifier is optional; source control and timed ventilation remain primary household tools.'
        : null,
      informationCategory: scenarioSimulatedPurifier
        ? 'general_educational_guidance'
        : 'estimated_inferred_indoor',
    };
  }

  return {
    hasPurifier: false,
    scenarioSimulatedPurifier: false,
    headline: 'Practical indoor particle-reduction steps without an air purifier',
    summary:
      'Your household profile does not report a portable air purifier. Focus on low-cost source prevention, surface cleaning habits, and outdoor-timed airing—no equipment purchase is required to apply these core steps.',
    practicalGuidance: [
      'Prevent indoor particle generation at the source: avoid indoor smoking, candles, and incense, and cover pots or use existing kitchen exhaust fans while cooking.',
      'Use damp microfiber cloths or wet mopping instead of dry dusting or dry sweeping so settled dust is captured rather than kicked back into breathing height.',
      'Time brief window airing around comparatively lower outdoor pollution windows when outdoor telemetry indicates cleaner periods, while keeping street-facing windows shut during heavy traffic peaks.',
      ...(profile.ventilationContext === 'filtered_hvac_merv13' ||
      profile.ventilationContext === 'mechanical_hvac'
        ? [
            'Check your central HVAC return filter monthly during winter smog episodes and verify it fits tightly in its frame according to your HVAC manual (do not force higher-resistance filters into systems not rated for them).',
          ]
        : []),
    ],
    gasAndVocLimitation,
    nonPurchaseNote:
      'No purchase pressure: reducing indoor emission sources and managing damp dust cleanup are foundational habits independent of owning an air purifier.',
    informationCategory: 'general_educational_guidance',
  };
}
