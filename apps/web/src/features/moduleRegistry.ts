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
    name: 'Air Quality Intelligence & Low-Emission Daily Routines',
    targetPhase: 'Phase 2–3',
    summary:
      'Live Open-Meteo model telemetry, US EPA & EEA AQI interpretation, 6-pollutant breakdown, time-of-day routine scheduling, and exposure-vs-emission clarity.',
  },
  {
    id: 'MOD-02-INDOOR-AIR-QUALITY',
    requirementId: 'REQ-PROD-02',
    name: 'Indoor Air Quality Assistant',
    targetPhase: 'Phase 4',
    summary:
      'No-sensor disclosure, 4-category evidence distinction, outdoor-informed ventilation states, HEPA particle-only limits, scenario explorer, and 7 indoor pollution source guides.',
  },
  {
    id: 'MOD-03-SUSTAINABLE-ALTERNATIVES',
    requirementId: 'REQ-PROD-03',
    name: 'Sustainable Alternatives Advisor',
    targetPhase: 'Phase 5',
    summary:
      'Personalized transport, heating, everyday habit, and waste alternatives with 4-way exposure/emissions/broader sustainability distinction, interactive comparison, and public-health citations.',
  },
  {
    id: 'MOD-04-PERSONALIZED-ADVISORY',
    requirementId: 'REQ-PROD-04',
    name: 'GenAI Location & Lifestyle Personalization',
    targetPhase: 'Phase 6',
    summary:
      'Controlled server-side Gemini briefing, context minimization, verified evidence guardrails, and graceful deterministic fallback.',
  },
  {
    id: 'MOD-05-IMPACT-EXPLANATIONS',
    requirementId: 'REQ-PROD-05',
    name: 'Direct Impact Explanations',
    targetPhase: 'Phase 6',
    summary:
      'Structured 6-part impact explanations and choice comparisons separating personal exposure, local emissions, filtration, climate, and broader sustainability.',
  },
] as const;
