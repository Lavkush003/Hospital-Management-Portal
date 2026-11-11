import { z } from 'zod';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '../auth/auth.validators';
import { dateOnlySchema, idSchema, paginationSchema } from '../../utils/validation';

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

const staffStatusSchema = z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED']);
const staffRoleSchema = z.enum(['ADMIN', 'FRONT_DESK']);

export const staffCreateSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: optionalText(32),
    employeeCode: employeeCodeSchema,
    departmentId: idSchema.optional(),
    jobTitle: z.string().trim().min(1).max(120),
    status: staffStatusSchema.default('ACTIVE'),
    role: staffRoleSchema.default('FRONT_DESK'),
    hiredAt: dateOnlySchema.optional(),
  })
  .strict();

export const staffUpdateSchema = z
  .object({
    email: emailSchema.optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phone: optionalText(32),
    employeeCode: employeeCodeSchema.optional(),
    departmentId: z.union([idSchema, z.null()]).optional(),
    jobTitle: z.string().trim().min(1).max(120).optional(),
    status: staffStatusSchema.optional(),
    role: staffRoleSchema.optional(),
    hiredAt: z.union([dateOnlySchema, z.null()]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one staff field must be provided',
  });

export const staffStatusSchemaUpdate = z
  .object({
    status: staffStatusSchema,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const staffRoleSchemaUpdate = z
  .object({
    role: staffRoleSchema,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const staffListQuerySchema = paginationSchema
  .extend({
    search: z.string().trim().min(1).max(200).optional(),
    departmentId: idSchema.optional(),
    status: staffStatusSchema.optional(),
    role: staffRoleSchema.optional(),
  })
  .strict();

export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
export type StaffStatusUpdateInput = z.infer<typeof staffStatusSchemaUpdate>;
export type StaffRoleUpdateInput = z.infer<typeof staffRoleSchemaUpdate>;
export type StaffListQuery = z.infer<typeof staffListQuerySchema>;
