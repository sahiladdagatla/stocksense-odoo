import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

export const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt ignores bytes past 72
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(80);

export const signupSchema = z.object({ name, email, password: passwordRule });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  email,
  otp: z.string().regex(/^\d{6}$/, 'The code must be 6 digits'),
  newPassword: passwordRule,
});

export const updateMeSchema = z
  .object({
    name: name.optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: passwordRule.optional(),
  })
  .refine((v) => !v.newPassword || v.currentPassword, {
    message: 'Current password is required to set a new password',
    path: ['currentPassword'],
  })
  .refine((v) => v.name !== undefined || v.newPassword !== undefined, {
    message: 'Nothing to update',
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
