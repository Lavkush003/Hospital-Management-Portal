import { z } from 'zod';
import { idSchema, isoDateTimeSchema, paginationSchema } from '../../utils/validation';

const visitStatusSchema = z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

const optionalText = (maxLength: number) =>
  z.string().trim().min(1, 'Value must not be empty when provided').max(maxLength).optional();

const vitalsSchema = z
  .object({
    heightCm: z.number().positive().max(300).optional(),
    weightKg: z.number().positive().max(500).optional(),
    temperatureC: z.number().positive().max(50).optional(),
    systolicBp: z.number().int().positive().max(300).optional(),
    diastolicBp: z.number().int().positive().max(200).optional(),
    heartRate: z.number().int().positive().max(300).optional(),
    respiratoryRate: z.number().int().positive().max(80).optional(),
    oxygenSaturation: z.number().int().min(0).max(100).optional(),
  })
  .refine(
    (value) =>
      value.systolicBp === undefined ||
      value.diastolicBp === undefined ||
      value.systolicBp > value.diastolicBp,
    {
      message: 'systolicBp must be greater than diastolicBp',
      path: ['systolicBp'],
    },
  );

export const createVisitBodySchema = z
  .object({
    patientId: idSchema,
    doctorId: idSchema.optional(),
    appointmentId: idSchema.optional(),
    startedAt: isoDateTimeSchema.optional(),
    chiefComplaint: optionalText(5_000),
    diagnosis: optionalText(10_000),
    clinicalNotes: optionalText(20_000),
    followUpAt: isoDateTimeSchema.optional(),
    followUpNotes: optionalText(1_000),
    vitals: vitalsSchema.optional(),
  })
  .strict();

export const updateVisitBodySchema = z
  .object({
    chiefComplaint: optionalText(5_000),
    diagnosis: optionalText(10_000),
    clinicalNotes: optionalText(20_000),
    followUpAt: isoDateTimeSchema.nullish(),
    followUpNotes: optionalText(1_000),
    vitals: vitalsSchema.optional(),
  })
  .strict();

export const visitStatusBodySchema = z
  .object({
    status: visitStatusSchema,
    reason: optionalText(2_000),
  })
  .strict();

export const visitListQuerySchema = paginationSchema
  .extend({
    patientId: idSchema.optional(),
    doctorId: idSchema.optional(),
    appointmentId: idSchema.optional(),
    status: visitStatusSchema.optional(),
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
    search: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((value) => value.from === undefined || value.to === undefined || value.to > value.from, {
    message: 'to must be after from',
    path: ['to'],
  });

export type CreateVisitBody = z.infer<typeof createVisitBodySchema>;
export type UpdateVisitBody = z.infer<typeof updateVisitBodySchema>;
export type VisitStatusBody = z.infer<typeof visitStatusBodySchema>;
export type VisitListQuery = z.infer<typeof visitListQuerySchema>;
