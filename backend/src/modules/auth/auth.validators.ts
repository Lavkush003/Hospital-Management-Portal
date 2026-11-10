import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

function hasValidBcryptLength(value: string): boolean {
  return Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES;
}

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(320, 'Email must be at most 320 characters')
  .email('Email must be a valid email address')
  .transform((value) => value.toLowerCase());

const loginPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(200, 'Password is too long')
  .refine(hasValidBcryptLength, 'Password must be at most 72 bytes');

const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200, 'Password is too long')
  .refine(hasValidBcryptLength, 'Password must be at most 72 bytes');

export const loginSchema = z
  .object({
    email: emailSchema,
    password: loginPasswordSchema,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: loginPasswordSchema,
    newPassword: newPasswordSchema,
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
