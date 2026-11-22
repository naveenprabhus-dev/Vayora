import type { PlannedModuleId } from '@uaqa/contracts';

export interface PlannedModuleDefinition {
  readonly id: PlannedModuleId;
  readonly requirementId: string;
  readonly name: string;
  readonly targetPhase: string;
  readonly summary: string;
}

export const PLANNED_PRODUCT_MODULES: readonly PlannedModuleDefinition[] = [
  {
    id: 'MOD-AUTH',
    requirementId: 'REQ-AUTH-01',
    name: 'Verified Identity & Household Onboarding',
    targetPhase: 'Phase 1',
    summary:
      'Mandatory account registration, email verification enforcement, session revocation, and location-lifestyle profile setup.',
  },
  {
    id: 'MOD-01-LOW-EMISSION-ROUTINES',
    requirementId: 'REQ-PROD-01',
    name: 'Air Quality Intelligence & Baseline Routines',
    targetPhase: 'Phase 2',
    summary:
      'Live Open-Meteo model telemetry, US EPA & EEA AQI interpretation, 6-pollutant breakdown, hourly forecast, and proportionate winter smog precautions.',
  },
  {
    id: 'MOD-02-INDOOR-AIR-QUALITY',
    requirementId: 'REQ-PROD-02',
    name: 'Indoor Air Quality Guidance',
    targetPhase: 'Phase 3',
    summary:
      'Practical ventilation timing, filtration upkeep, and indoor particulate reduction steps matched to outdoor AQI.',
  },
  {
    id: 'MOD-03-SUSTAINABLE-ALTERNATIVES',
    requirementId: 'REQ-PROD-03',
    name: 'Sustainable Alternatives Advisor',
    targetPhase: 'Phase 3',
    summary:
      'Actionable lower-emission alternatives for daily transport, cooking, and home heating choices.',
  },
  {
    id: 'MOD-04-PERSONALIZED-ADVISORY',
    requirementId: 'REQ-PROD-04',
    name: 'Location & Lifestyle Personalization',
    targetPhase: 'Phase 4',
    summary:
      'Live AQI integration with graceful fallback guidance and Gemini-orchestrated household personalization.',
  },
  {
    id: 'MOD-05-IMPACT-EXPLANATIONS',
    requirementId: 'REQ-PROD-05',
    name: 'Direct Impact Explanations',
    targetPhase: 'Phase 5',
    summary:
      'Clear, evidence-grounded explanations of how each recommended choice reduces exposure and local emissions.',
  },
] as const;
