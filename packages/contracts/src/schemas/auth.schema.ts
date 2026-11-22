import { z } from 'zod';
import { USER_ROLES } from '../types/roles.ts';
import { boundedStringSchema, firestoreIdSchema } from './common.schema.ts';

export const userRoleSchema = z.enum(USER_ROLES);

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordStrengthAssessment {
  readonly score: 0 | 1 | 2 | 3 | 4;
  readonly label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  readonly checks: {
    readonly minLength: boolean;
    readonly hasUppercase: boolean;
    readonly hasLowercase: boolean;
    readonly hasDigit: boolean;
    readonly hasSpecial: boolean;
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrengthAssessment {
  const checks = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  const metCount = Object.values(checks).filter(Boolean).length;
  if (metCount <= 1) {
    return { score: 0, label: 'Very weak', checks };
  }
  if (metCount === 2) {
    return { score: 1, label: 'Weak', checks };
  }
  if (metCount === 3) {
    return { score: 2, label: 'Fair', checks };
  }
  if (metCount === 4) {
    return { score: 3, label: 'Strong', checks };
  }
  return { score: 4, label: 'Very strong', checks };
}

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'Email address is required.')
  .max(320, 'Email address must not exceed 320 characters.')
  .email('Enter a valid email address.');

export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`)
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
  .regex(/[0-9]/, 'Password must include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character.');

export const registrationInputSchema = z
  .object({
    displayName: boundedStringSchema(2, 80, 'Full name'),
    email: emailSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
    acceptedTerms: z.literal(true, {
      error: 'You must acknowledge the terms and privacy notice to register.',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Password is required.')
    .max(PASSWORD_MAX_LENGTH, `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`),
});

export const forgotPasswordInputSchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmSchema = z
  .object({
    oobCode: z.string().trim().min(6, 'Invalid password reset link code.').max(512),
    newPassword: strongPasswordSchema,
    confirmNewPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match.',
    path: ['confirmNewPassword'],
  });

export const authenticatedPrincipalSchema = z.object({
  uid: firestoreIdSchema,
  email: z.string().email().max(320),
  emailVerified: z.boolean(),
  role: userRoleSchema,
  authTimeSeconds: z.number().int().nonnegative(),
});

export const sessionStatusSchema = z.object({
  authenticated: z.literal(true),
  principal: authenticatedPrincipalSchema,
});

export type RegistrationInput = z.infer<typeof registrationInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
