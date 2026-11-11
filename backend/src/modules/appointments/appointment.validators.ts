import { z } from 'zod';
import {
  availabilityRangeSchema,
  idSchema,
  isoDateTimeSchema,
  paginationSchema,
} from '../../utils/validation';

const appointmentStatusSchema = z.enum([
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

const optionalText = (maxLength: number) =>
  z.string().trim().min(1, 'Value must not be empty when provided').max(maxLength).optional();

const appointmentWindowFieldsSchema = z.object({
  scheduledStart: isoDateTimeSchema,
  scheduledEnd: isoDateTimeSchema,
});

function refineAppointmentWindow<T extends z.ZodType<{ scheduledStart: Date; scheduledEnd: Date }>>(
  schema: T,
) {
  return schema
    .refine((value) => value.scheduledEnd > value.scheduledStart, {
      message: 'scheduledEnd must be after scheduledStart',
      path: ['scheduledEnd'],
    })
    .refine((value) => value.scheduledStart.getTime() > Date.now(), {
      message: 'scheduledStart must be in the future',
      path: ['scheduledStart'],
    });
}

export const bookAppointmentBodySchema = refineAppointmentWindow(
  appointmentWindowFieldsSchema
    .extend({
      patientId: idSchema,
      doctorId: idSchema,
      reason: optionalText(2_000),
      notes: optionalText(5_000),
      idempotencyKey: z.string().trim().min(8).max(200).optional(),
    })
    .strict(),
);

export const rescheduleAppointmentBodySchema = refineAppointmentWindow(
  appointmentWindowFieldsSchema
    .extend({
      reason: optionalText(2_000),
      idempotencyKey: z.string().trim().min(8).max(200).optional(),
    })
    .strict(),
);

export const cancelAppointmentBodySchema = z
  .object({
    cancellationReason: z.string().trim().min(3).max(2_000),
    idempotencyKey: z.string().trim().min(8).max(200).optional(),
  })
  .strict();

export const appointmentStatusBodySchema = z
  .object({
    status: appointmentStatusSchema,
    reason: optionalText(2_000),
  })
  .strict();

export const appointmentListQuerySchema = paginationSchema
  .extend({
    status: appointmentStatusSchema.optional(),
    doctorId: idSchema.optional(),
    patientId: idSchema.optional(),
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
    search: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((value) => value.from === undefined || value.to === undefined || value.to > value.from, {
    message: 'to must be after from',
    path: ['to'],
  });

export const availableSlotsQuerySchema = availabilityRangeSchema.and(
  z.object({ doctorId: idSchema }).strict(),
);

export const availableDoctorsQuerySchema = availabilityRangeSchema.and(
  z
    .object({
      search: z.string().trim().min(1).max(200).optional(),
      departmentId: idSchema.optional(),
      specialization: z.string().trim().min(1).max(120).optional(),
      page: z.coerce.number().int().min(1).max(1_000_000).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict(),
);

export type BookAppointmentBody = z.infer<typeof bookAppointmentBodySchema>;
export type RescheduleAppointmentBody = z.infer<typeof rescheduleAppointmentBodySchema>;
export type CancelAppointmentBody = z.infer<typeof cancelAppointmentBodySchema>;
export type AppointmentStatusBody = z.infer<typeof appointmentStatusBodySchema>;
export type AppointmentListQueryInput = z.infer<typeof appointmentListQuerySchema>;
export type AvailableSlotsQuery = z.infer<typeof availableSlotsQuerySchema>;
export type AvailableDoctorsQuery = z.infer<typeof availableDoctorsQuerySchema>;
