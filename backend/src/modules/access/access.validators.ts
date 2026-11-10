import { z } from 'zod';

function isValidDateOnly(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getTime() <= Date.now()
  );
}

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must use YYYY-MM-DD format')
  .refine(isValidDateOnly, 'dateOfBirth must be a valid date that is not in the future')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const optionalText = (maxLength: number) =>
  z.string().trim().min(1, 'Value must not be empty when provided').max(maxLength).optional();

export const createPatientSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    dateOfBirth: dateOnlySchema,
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).default('UNKNOWN'),
    bloodGroup: z
      .enum([
        'A_POSITIVE',
        'A_NEGATIVE',
        'B_POSITIVE',
        'B_NEGATIVE',
        'AB_POSITIVE',
        'AB_NEGATIVE',
        'O_POSITIVE',
        'O_NEGATIVE',
        'UNKNOWN',
      ])
      .default('UNKNOWN'),
    phone: optionalText(32),
    email: z.string().trim().email().max(320).optional(),
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    city: optionalText(100),
    state: optionalText(100),
    postalCode: optionalText(20),
    country: optionalText(100),
    emergencyContactName: optionalText(200),
    emergencyContactPhone: optionalText(32),
  })
  .strict();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
