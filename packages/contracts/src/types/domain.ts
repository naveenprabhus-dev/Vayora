import type { UserRole } from './roles.ts';

export type AirQualitySeverity =
  'good' | 'moderate' | 'unhealthy_sensitive' | 'unhealthy' | 'very_unhealthy' | 'hazardous';

export type PlannedModuleId =
  | 'MOD-AUTH'
  | 'MOD-01-LOW-EMISSION-ROUTINES'
  | 'MOD-02-INDOOR-AIR-QUALITY'
  | 'MOD-03-SUSTAINABLE-ALTERNATIVES'
  | 'MOD-04-PERSONALIZED-ADVISORY'
  | 'MOD-05-IMPACT-EXPLANATIONS';

export interface AuthenticatedPrincipal {
  readonly uid: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly role: UserRole;
  readonly authTimeSeconds: number;
}

export interface HealthStatusPayload {
  readonly status: 'ok' | 'degraded';
  readonly service: 'urban-air-quality-api';
  readonly version: string;
  readonly environment: string;
  readonly uptimeSeconds: number;
}
