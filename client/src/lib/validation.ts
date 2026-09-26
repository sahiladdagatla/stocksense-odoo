import { z } from 'zod';

// Mirrors server/src/schemas/auth.schema.ts so users see the same rules before submitting.
export const emailRule = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .pipe(z.email('Enter a valid email'));

export const passwordRule = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/[0-9]/, 'Include a number');

export const nameRule = z.string().trim().min(2, 'At least 2 characters').max(80);
