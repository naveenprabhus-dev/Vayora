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

export function boundedStringSchema(minLength: number, maxLength: number, fieldName: string) {
  return z
    .string()
    .trim()
    .min(minLength, `${fieldName} must be at least ${minLength} characters.`)
    .max(maxLength, `${fieldName} must not exceed ${maxLength} characters.`);
}
