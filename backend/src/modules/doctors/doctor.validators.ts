import { z } from 'zod';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '../auth/auth.validators';
import { idSchema, paginationSchema } from '../../utils/validation';

const emailSchema = z
  .string()
  .trim()
  .min(1)
  .max(320)
  .email()
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200)
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES,
    'Password must be at most 72 bytes',
  );

const employeeCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Employee code contains unsupported characters')
  .transform((value) => value.toUpperCase());

const optionalText = (maxLength: number) =>
  z.string().trim().min(1, 'Value must not be empty when provided').max(maxLength).optional();

const doctorStatusSchema = z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE']);

export const doctorCreateSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: optionalText(32),
    employeeCode: employeeCodeSchema,
    departmentId: idSchema,
    licenseNumber: z.string().trim().min(1).max(64),
    specialization: z.string().trim().min(1).max(120),
    qualifications: z.string().trim().max(10_000).optional(),
    consultationFee: z.coerce.number().min(0).max(1_000_000_000).default(0),
    status: doctorStatusSchema.default('ACTIVE'),
    bio: z.string().trim().max(10_000).optional(),
  })
  .strict();

export const doctorUpdateSchema = z
  .object({
    email: emailSchema.optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phone: optionalText(32),
    employeeCode: employeeCodeSchema.optional(),
    departmentId: idSchema.optional(),
    licenseNumber: z.string().trim().min(1).max(64).optional(),
    specialization: z.string().trim().min(1).max(120).optional(),
    qualifications: z.string().trim().max(10_000).optional(),
    consultationFee: z.coerce.number().min(0).max(1_000_000_000).optional(),
    status: doctorStatusSchema.optional(),
    bio: z.string().trim().max(10_000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one doctor field must be provided',
  });

export const doctorStatusSchemaUpdate = z
  .object({
    status: doctorStatusSchema,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const doctorListQuerySchema = paginationSchema
  .extend({
    search: z.string().trim().min(1).max(200).optional(),
    departmentId: idSchema.optional(),
    specialization: z.string().trim().min(1).max(120).optional(),
    status: doctorStatusSchema.optional(),
  })
  .strict();

export type DoctorCreateInput = z.infer<typeof doctorCreateSchema>;
export type DoctorUpdateInput = z.infer<typeof doctorUpdateSchema>;
export type DoctorStatusUpdateInput = z.infer<typeof doctorStatusSchemaUpdate>;
export type DoctorListQuery = z.infer<typeof doctorListQuerySchema>;
