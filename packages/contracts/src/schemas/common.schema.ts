import { z } from 'zod';

export const FIRESTORE_ID_MAX_LENGTH = 128;
export const FIRESTORE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const firestoreIdSchema = z
  .string()
  .min(1, 'Identifier cannot be empty.')
  .max(FIRESTORE_ID_MAX_LENGTH, `Identifier cannot exceed ${FIRESTORE_ID_MAX_LENGTH} characters.`)
  .regex(
    FIRESTORE_ID_PATTERN,
    'Identifier may only contain alphanumeric characters, underscores, and hyphens.',
  );

export const isoTimestampSchema = z.string().datetime({ offset: true });

function hasControlOrBidiChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    ) {
      return true;
    }
  }
  return false;
}

export function boundedStringSchema(minLength: number, maxLength: number, fieldName: string) {
  return z
    .string()
    .trim()
    .min(minLength, `${fieldName} must be at least ${minLength} characters.`)
    .max(maxLength, `${fieldName} must not exceed ${maxLength} characters.`)
    .refine(
      (value) => !hasControlOrBidiChar(value),
      `${fieldName} contains unsupported control characters.`,
    );
}
