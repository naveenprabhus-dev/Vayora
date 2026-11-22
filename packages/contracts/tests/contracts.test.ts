import { describe, expect, it } from 'vitest';
import {
  apiErrorResponseSchema,
  authenticatedPrincipalSchema,
  createApiSuccessSchema,
  evaluatePasswordStrength,
  firestoreIdSchema,
  forgotPasswordInputSchema,
  healthStatusPayloadSchema,
  householdLifestyleInputSchema,
  loginInputSchema,
  passwordResetConfirmSchema,
  registrationInputSchema,
  roleHasPermission,
} from '../src/index.ts';

describe('@uaqa/contracts', () => {
  describe('firestoreIdSchema', () => {
    it('accepts valid alphanumeric, underscore, and hyphen identifiers', () => {
      expect(firestoreIdSchema.safeParse('user_123-abc').success).toBe(true);
    });

    it('rejects path traversal and empty or oversized IDs', () => {
      expect(firestoreIdSchema.safeParse('').success).toBe(false);
      expect(firestoreIdSchema.safeParse('../admin/secret').success).toBe(false);
      expect(firestoreIdSchema.safeParse('id with spaces').success).toBe(false);
      expect(firestoreIdSchema.safeParse('a'.repeat(129)).success).toBe(false);
    });
  });

  describe('authentication validation schemas', () => {
    it('evaluates password strength accurately across all criteria', () => {
      expect(evaluatePasswordStrength('weak').score).toBe(0);
      expect(evaluatePasswordStrength('StrongPass1!').score).toBe(4);
      expect(evaluatePasswordStrength('StrongPass1!').label).toBe('Very strong');
    });

    it('validates registration input and rejects mismatched passwords or unchecked terms', () => {
      const valid = registrationInputSchema.safeParse({
        displayName: 'Elena Nowak',
        email: 'elena@example.org',
        password: 'WinterCleanAir2026!',
        confirmPassword: 'WinterCleanAir2026!',
        acceptedTerms: true,
      });
      expect(valid.success).toBe(true);

      const mismatched = registrationInputSchema.safeParse({
        displayName: 'Elena Nowak',
        email: 'elena@example.org',
        password: 'WinterCleanAir2026!',
        confirmPassword: 'DifferentPassword1!',
        acceptedTerms: true,
      });
      expect(mismatched.success).toBe(false);

      const noTerms = registrationInputSchema.safeParse({
        displayName: 'Elena Nowak',
        email: 'elena@example.org',
        password: 'WinterCleanAir2026!',
        confirmPassword: 'WinterCleanAir2026!',
        acceptedTerms: false,
      });
      expect(noTerms.success).toBe(false);
    });

    it('validates login, forgot password, and password reset confirmation inputs', () => {
      expect(
        loginInputSchema.safeParse({ email: 'family@example.org', password: 'secret' }).success,
      ).toBe(true);
      expect(loginInputSchema.safeParse({ email: 'bad-email', password: '' }).success).toBe(false);

      expect(forgotPasswordInputSchema.safeParse({ email: 'family@example.org' }).success).toBe(
        true,
      );
      expect(forgotPasswordInputSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);

      expect(
        passwordResetConfirmSchema.safeParse({
          oobCode: 'oob_code_12345',
          newPassword: 'UpdatedAirPassword9!',
          confirmNewPassword: 'UpdatedAirPassword9!',
        }).success,
      ).toBe(true);
      expect(
        passwordResetConfirmSchema.safeParse({
          oobCode: 'short',
          newPassword: 'weak',
          confirmNewPassword: 'other',
        }).success,
      ).toBe(false);
    });
  });

  describe('RBAC roles and permissions', () => {
    it('enforces least privilege between regular_user, community_coordinator, and admin', () => {
      expect(roleHasPermission('regular_user', 'recommendations:generate_own')).toBe(true);
      expect(roleHasPermission('regular_user', 'community_advisory:publish')).toBe(false);
      expect(roleHasPermission('regular_user', 'roles:manage')).toBe(false);

      expect(roleHasPermission('community_coordinator', 'community_advisory:publish')).toBe(true);
      expect(roleHasPermission('community_coordinator', 'roles:manage')).toBe(false);

      expect(roleHasPermission('admin', 'roles:manage')).toBe(true);
      expect(roleHasPermission('admin', 'system:audit_read')).toBe(true);
    });

    it('rejects unrecognized role names in authenticatedPrincipalSchema', () => {
      const result = authenticatedPrincipalSchema.safeParse({
        uid: 'uid_abc123',
        email: 'family@example.org',
        emailVerified: true,
        role: 'super_root_guest',
        authTimeSeconds: 1700000000,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('API envelope schemas', () => {
    it('validates standardized success and error payloads', () => {
      const healthEnvelope = createApiSuccessSchema(healthStatusPayloadSchema);
      const validSuccess = healthEnvelope.safeParse({
        success: true,
        data: {
          status: 'ok',
          service: 'urban-air-quality-api',
          version: '0.1.0',
          environment: 'test',
          uptimeSeconds: 12.5,
        },
        meta: {
          requestId: 'req-1234',
          timestamp: '2026-11-19T12:00:00.000Z',
        },
      });
      expect(validSuccess.success).toBe(true);

      const validError = apiErrorResponseSchema.safeParse({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email verification is required before accessing protected resources.',
        },
        meta: {
          requestId: 'req-1234',
          timestamp: '2026-11-19T12:00:00.000Z',
        },
      });
      expect(validError.success).toBe(true);
    });
  });

  describe('householdLifestyleInputSchema', () => {
    it('accepts valid household location and lifestyle profile input', () => {
      const result = householdLifestyleInputSchema.safeParse({
        country: 'Poland',
        city: 'Warsaw',
        neighborhood: 'Mokotow',
        postalPrefix: '02-5',
        locationPreferences: {
          primaryZoneType: 'urban_core',
          alertsEnabled: true,
        },
        householdSize: 4,
        householdComposition: ['adults', 'school_age_children'],
        primaryCommuteMode: 'public_transit',
        outdoorActivityPattern: 'school_run_family',
        ventilationContext: 'filtered_hvac_merv13',
        hasIndoorAirPurifier: true,
        heatingType: 'district',
        lifestylePreferences: {
          preferredGuidanceFocus: 'balanced',
          reminderCadence: 'daily_smog_alerts',
        },
        onboardingCompleted: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects out-of-bounds household size and invalid postal characters', () => {
      const result = householdLifestyleInputSchema.safeParse({
        country: 'P',
        city: 'W',
        neighborhood: 'Mokotow',
        postalPrefix: '02-5<script>',
        locationPreferences: {
          primaryZoneType: 'urban_core',
          alertsEnabled: true,
        },
        householdSize: 0,
        householdComposition: [],
        primaryCommuteMode: 'walking',
        outdoorActivityPattern: 'mostly_indoors',
        ventilationContext: 'natural_windows',
        hasIndoorAirPurifier: false,
        heatingType: 'solid_fuel',
        lifestylePreferences: {
          preferredGuidanceFocus: 'balanced',
          reminderCadence: 'high_aqi_only',
        },
        onboardingCompleted: false,
      });
      expect(result.success).toBe(false);
    });
  });
});
