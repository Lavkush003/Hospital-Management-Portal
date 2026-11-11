import { z } from 'zod';
import { dateOnlySchema, paginationSchema } from '../../utils/validation';

const optionalText = (maxLength: number) =>
  z.string().trim().min(1, 'Value must not be empty when provided').max(maxLength).optional();

const genderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']);
const bloodGroupSchema = z.enum([
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
  'UNKNOWN',
]);
const patientStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'DECEASED']);

export const patientCreateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    dateOfBirth: dateOnlySchema,
    gender: genderSchema.default('UNKNOWN'),
    bloodGroup: bloodGroupSchema.default('UNKNOWN'),
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
    allergies: z.string().trim().max(10_000).optional(),
    notes: z.string().trim().max(10_000).optional(),
    status: patientStatusSchema.default('ACTIVE'),
  })
  .strict();

export const patientUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    dateOfBirth: dateOnlySchema.optional(),
    gender: genderSchema.optional(),
    bloodGroup: bloodGroupSchema.optional(),
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
    allergies: z.string().trim().max(10_000).optional(),
    notes: z.string().trim().max(10_000).optional(),
    status: patientStatusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one patient field must be provided',
  });

export const patientListQuerySchema = paginationSchema
  .extend({
    search: z.string().trim().min(1).max(200).optional(),
    status: patientStatusSchema.optional(),
    gender: genderSchema.optional(),
    bloodGroup: bloodGroupSchema.optional(),
    city: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type PatientCreateInput = z.infer<typeof patientCreateSchema>;
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;
