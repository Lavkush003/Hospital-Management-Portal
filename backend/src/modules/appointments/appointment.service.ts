import { randomBytes } from 'node:crypto';
import type { Appointment, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { runIdempotentOperation } from '../../services/idempotency.service';
import {
  isExclusionConstraintError,
  isForeignKeyConstraintError,
} from '../../utils/database-errors';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';

const OVERLAP_CONSTRAINT = 'Appointment_no_doctor_overlap_active_excl';
const RESCHEDULABLE_STATUSES = new Set(['SCHEDULED', 'CONFIRMED']);
const CANCELLABLE_STATUSES = new Set(['SCHEDULED', 'CONFIRMED']);

const appointmentWindowSchema = z
  .object({
    scheduledStart: z.date(),
    scheduledEnd: z.date(),
  })
  .refine((value) => value.scheduledEnd > value.scheduledStart, {
    message: 'scheduledEnd must be after scheduledStart',
    path: ['scheduledEnd'],
  });

const bookAppointmentSchema = appointmentWindowSchema.extend({
  actorUserId: z.string().min(1),
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  reason: z.string().trim().max(2_000).optional(),
  notes: z.string().trim().max(5_000).optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

const rescheduleAppointmentSchema = appointmentWindowSchema.extend({
  actorUserId: z.string().min(1),
  appointmentId: z.string().min(1),
  reason: z.string().trim().max(2_000).optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

const cancelAppointmentSchema = z.object({
  actorUserId: z.string().min(1),
  appointmentId: z.string().min(1),
  cancellationReason: z.string().trim().min(3).max(2_000),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

const appointmentInclude = {
  patient: true,
  doctor: true,
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

export interface AppointmentMutationResult {
  appointment: AppointmentWithRelations;
  replayed: boolean;
}

function appointmentSnapshot(appointment: Appointment): Prisma.InputJsonObject {
  return {
    id: appointment.id,
    appointmentNumber: appointment.appointmentNumber,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    scheduledStart: appointment.scheduledStart.toISOString(),
    scheduledEnd: appointment.scheduledEnd.toISOString(),
    status: appointment.status,
    reason: appointment.reason,
    notes: appointment.notes,
    cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
    cancellationReason: appointment.cancellationReason,
  };
}

function createAppointmentNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomBytes(4).toString('hex').toUpperCase();
  return `APT-${timestamp}-${randomSuffix}`;
}

async function loadAppointment(appointmentId: string): Promise<AppointmentWithRelations> {
  return prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: appointmentInclude,
  });
}

function mapAppointmentMutationError(error: unknown): unknown {
  if (isExclusionConstraintError(error, OVERLAP_CONSTRAINT)) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'The doctor already has an active appointment during this time',
      'APPOINTMENT_SLOT_CONFLICT',
    );
  }

  if (isForeignKeyConstraintError(error)) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'The appointment references a patient, doctor, or user that does not exist',
      'APPOINTMENT_REFERENCE_CONFLICT',
    );
  }

  return error;
}

export async function bookAppointment(
  input: BookAppointmentInput,
): Promise<AppointmentMutationResult> {
  const parsed = bookAppointmentSchema.parse(input);
  const payload = {
    patientId: parsed.patientId,
    doctorId: parsed.doctorId,
    scheduledStart: parsed.scheduledStart,
    scheduledEnd: parsed.scheduledEnd,
    reason: parsed.reason ?? null,
    notes: parsed.notes ?? null,
  };

  try {
    const outcome = await runIdempotentOperation({
      actorUserId: parsed.actorUserId,
      scope: 'appointments.book',
      key: parsed.idempotencyKey,
      payload,
      resourceType: 'Appointment',
      responseStatusCode: HTTP_STATUS.CREATED,
      operation: async (transaction) => {
        const [patient, doctor] = await Promise.all([
          transaction.patient.findUnique({
            where: { id: parsed.patientId },
            select: { id: true, status: true },
          }),
          transaction.doctor.findUnique({
            where: { id: parsed.doctorId },
            select: { id: true, status: true },
          }),
        ]);

        if (!patient) {
          throw new AppError(HTTP_STATUS.NOT_FOUND, 'Patient not found', 'PATIENT_NOT_FOUND');
        }

        if (patient.status !== 'ACTIVE') {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            'Appointments can only be booked for active patients',
            'PATIENT_NOT_ACTIVE',
          );
        }

        if (!doctor) {
          throw new AppError(HTTP_STATUS.NOT_FOUND, 'Doctor not found', 'DOCTOR_NOT_FOUND');
        }

        if (doctor.status !== 'ACTIVE') {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            'Appointments can only be booked with active doctors',
            'DOCTOR_NOT_ACTIVE',
          );
        }

        const appointment = await transaction.appointment.create({
          data: {
            appointmentNumber: createAppointmentNumber(),
            patientId: parsed.patientId,
            doctorId: parsed.doctorId,
            scheduledStart: parsed.scheduledStart,
            scheduledEnd: parsed.scheduledEnd,
            status: 'SCHEDULED',
            reason: parsed.reason,
            notes: parsed.notes,
            createdById: parsed.actorUserId,
          },
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: parsed.actorUserId,
            action: 'APPOINTMENT_BOOKED',
            entityType: 'Appointment',
            entityId: appointment.id,
            after: appointmentSnapshot(appointment),
            metadata: { source: 'appointment-service' },
          },
        });

        return appointment.id;
      },
    });

    return {
      appointment: await loadAppointment(outcome.resourceId),
      replayed: outcome.replayed,
    };
  } catch (error) {
    throw mapAppointmentMutationError(error);
  }
}

export async function rescheduleAppointment(
  input: RescheduleAppointmentInput,
): Promise<AppointmentMutationResult> {
  const parsed = rescheduleAppointmentSchema.parse(input);
  const payload = {
    appointmentId: parsed.appointmentId,
    scheduledStart: parsed.scheduledStart,
    scheduledEnd: parsed.scheduledEnd,
    reason: parsed.reason ?? null,
  };

  try {
    const outcome = await runIdempotentOperation({
      actorUserId: parsed.actorUserId,
      scope: `appointments.reschedule:${parsed.appointmentId}`,
      key: parsed.idempotencyKey,
      payload,
      resourceType: 'Appointment',
      responseStatusCode: HTTP_STATUS.OK,
      operation: async (transaction) => {
        const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Appointment"
          WHERE "id" = ${parsed.appointmentId}
          FOR UPDATE
        `;

        if (lockedRows.length === 0) {
          throw new AppError(
            HTTP_STATUS.NOT_FOUND,
            'Appointment not found',
            'APPOINTMENT_NOT_FOUND',
          );
        }

        const current = await transaction.appointment.findUniqueOrThrow({
          where: { id: parsed.appointmentId },
        });

        if (!RESCHEDULABLE_STATUSES.has(current.status)) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            'Only scheduled or confirmed appointments can be rescheduled',
            'APPOINTMENT_NOT_RESCHEDULABLE',
          );
        }

        const rescheduledAt = new Date();
        const updated = await transaction.appointment.update({
          where: { id: current.id },
          data: {
            scheduledStart: parsed.scheduledStart,
            scheduledEnd: parsed.scheduledEnd,
            rescheduledAt,
            rescheduledById: parsed.actorUserId,
          },
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: parsed.actorUserId,
            action: 'APPOINTMENT_RESCHEDULED',
            entityType: 'Appointment',
            entityId: current.id,
            before: appointmentSnapshot(current),
            after: appointmentSnapshot(updated),
            metadata: {
              source: 'appointment-service',
              reason: parsed.reason ?? null,
            },
          },
        });

        return current.id;
      },
    });

    return {
      appointment: await loadAppointment(outcome.resourceId),
      replayed: outcome.replayed,
    };
  } catch (error) {
    throw mapAppointmentMutationError(error);
  }
}

export async function cancelAppointment(
  input: CancelAppointmentInput,
): Promise<AppointmentMutationResult> {
  const parsed = cancelAppointmentSchema.parse(input);
  const payload = {
    appointmentId: parsed.appointmentId,
    cancellationReason: parsed.cancellationReason,
  };

  try {
    const outcome = await runIdempotentOperation({
      actorUserId: parsed.actorUserId,
      scope: `appointments.cancel:${parsed.appointmentId}`,
      key: parsed.idempotencyKey,
      payload,
      resourceType: 'Appointment',
      responseStatusCode: HTTP_STATUS.OK,
      operation: async (transaction) => {
        const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Appointment"
          WHERE "id" = ${parsed.appointmentId}
          FOR UPDATE
        `;

        if (lockedRows.length === 0) {
          throw new AppError(
            HTTP_STATUS.NOT_FOUND,
            'Appointment not found',
            'APPOINTMENT_NOT_FOUND',
          );
        }

        const current = await transaction.appointment.findUniqueOrThrow({
          where: { id: parsed.appointmentId },
        });

        if (!CANCELLABLE_STATUSES.has(current.status)) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            'Only scheduled or confirmed appointments can be cancelled',
            'APPOINTMENT_NOT_CANCELLABLE',
          );
        }

        const cancelledAt = new Date();
        const updated = await transaction.appointment.update({
          where: { id: current.id },
          data: {
            status: 'CANCELLED',
            cancelledAt,
            cancellationReason: parsed.cancellationReason,
            cancelledById: parsed.actorUserId,
          },
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: parsed.actorUserId,
            action: 'APPOINTMENT_CANCELLED',
            entityType: 'Appointment',
            entityId: current.id,
            before: appointmentSnapshot(current),
            after: appointmentSnapshot(updated),
            metadata: {
              source: 'appointment-service',
              reason: parsed.cancellationReason,
            },
          },
        });

        return current.id;
      },
    });

    return {
      appointment: await loadAppointment(outcome.resourceId),
      replayed: outcome.replayed,
    };
  } catch (error) {
    throw mapAppointmentMutationError(error);
  }
}
