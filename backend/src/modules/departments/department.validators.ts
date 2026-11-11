import { z } from 'zod';
import { idSchema, paginationSchema } from '../../utils/validation';

const departmentCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Code contains unsupported characters')
  .transform((value) => value.toUpperCase());

const optionalText = (maxLength: number) =>
  z.string().trim().min(1, 'Value must not be empty when provided').max(maxLength).optional();

export const departmentCreateSchema = z
  .object({
    code: departmentCodeSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(10_000).optional(),
    location: optionalText(160),
    phone: optionalText(32),
    isActive: z.boolean().default(true),
  })
  .strict();

export const departmentUpdateSchema = z
  .object({
    code: departmentCodeSchema.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(10_000).optional(),
    location: optionalText(160),
    phone: optionalText(32),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one department field must be provided',
  });

export const departmentListQuerySchema = paginationSchema
  .extend({
    search: z.string().trim().min(1).max(200).optional(),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === 'true')),
  })
  .strict();

export const assignDoctorsSchema = z
  .object({
    doctorIds: z
      .array(idSchema)
      .min(1)
      .max(200)
      .refine((values) => new Set(values).size === values.length, {
        message: 'doctorIds must not contain duplicates',
      }),
  })
  .strict();

export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>;
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>;
export type DepartmentListQuery = z.infer<typeof departmentListQuerySchema>;
export type AssignDoctorsInput = z.infer<typeof assignDoctorsSchema>;
