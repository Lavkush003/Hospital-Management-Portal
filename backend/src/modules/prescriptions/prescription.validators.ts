import { z } from 'zod';
import { isoDateTimeSchema } from '../../utils/validation';

const prescriptionStatusSchema = z.enum(['ISSUED', 'DISPENSED', 'CANCELLED']);

const optionalText = (maxLength: number) =>
  z.string().trim().min(1, 'Value must not be empty when provided').max(maxLength).optional();

const prescriptionItemSchema = z
  .object({
    medicationName: z.string().trim().min(1).max(200),
    dosage: z.string().trim().min(1).max(100),
    frequency: z.string().trim().min(1).max(100),
    durationDays: z.number().int().min(1).max(730),
    quantity: z.number().int().min(1).max(10_000),
    instructions: optionalText(2_000),
  })
  .strict();

export const createPrescriptionBodySchema = z
  .object({
    items: z.array(prescriptionItemSchema).min(1).max(20),
    notes: optionalText(5_000),
    issuedAt: isoDateTimeSchema
      .optional()
      .refine((value) => value === undefined || value.getTime() <= Date.now(), {
        message: 'issuedAt must not be in the future',
      }),
  })
  .strict();

export const prescriptionStatusBodySchema = z
  .object({
    status: prescriptionStatusSchema,
    reason: optionalText(2_000),
  })
  .strict();

export type CreatePrescriptionBody = z.infer<typeof createPrescriptionBodySchema>;
export type PrescriptionStatusBody = z.infer<typeof prescriptionStatusBodySchema>;
