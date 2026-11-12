import { randomBytes } from 'node:crypto';
import type { Appointment, AppointmentStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { runIdempotentOperation } from '../../services/idempotency.service';
import {
  isExclusionConstraintError,
  isForeignKeyConstraintError,
} from '../../utils/database-errors';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { paginationMeta, paginationWindow, type PaginationMeta } from '../../utils/validation';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import { appointmentSlotUnavailableError, isSlotAvailable } from './availability.service';

const OVERLAP_CONSTRAINT = 'Appointment_no_doctor_overlap_active_excl';
const RESCHEDULABLE_STATUSES = new Set(['SCHEDULED', 'CONFIRMED']);
const CANCELLABLE_STATUSES = new Set(['SCHEDULED', 'CONFIRMED']);

const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'NO_SHOW'],
  CONFIRMED: ['CHECKED_IN', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const appointmentWindowSchema = z
  .object({
    scheduledStart: z.date(),
    scheduledEnd: z.date(),
  })
  .refine((value) => value.scheduledEnd > value.scheduledStart, {
    message: 'scheduledEnd must be after scheduledStart',
    path: ['scheduledEnd'],
  })
  .refine((value) => value.scheduledStart.getTime() > Date.now(), {
    message: 'scheduledStart must be in the future',
    path: ['scheduledStart'],
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

const appointmentStatusUpdateSchema = z.object({
  actorUserId: z.string().min(1),
  appointmentId: z.string().min(1),
  status: z.enum([
    'SCHEDULED',
    'CONFIRMED',
    'CHECKED_IN',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
  ]),
  reason: z.string().trim().max(2_000).optional(),
});

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export interface AppointmentStatusUpdateInput {
  actorUserId: string;
  appointmentId: string;
  status: AppointmentStatus;
  reason?: string;
}

export interface AppointmentListQuery {
  page: number;
  pageSize: number;
  status?: AppointmentStatus;
  doctorId?: string;
  patientId?: string;
  from?: Date;
  to?: Date;
  search?: string;
}

const appointmentInclude = {
  patient: {
    select: {
      id: true,
      patientNumber: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      bloodGroup: true,
      phone: true,
      email: true,
      status: true,
    },
  },
  doctor: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      specialization: true,
      consultationFee: true,
      status: true,
      department: {
        select: { id: true, code: true, name: true, location: true },
      },
    },
  },
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

export interface AppointmentMutationResult {
  appointment: AppointmentWithRelations;
  replayed: boolean;
}

export interface AppointmentListResult {
  appointments: AppointmentWithRelations[];
  pagination: PaginationMeta;
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
    cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
  };
}

function createAppointmentNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomBytes(4).toString('hex').toUpperCase();
  return `APT-${timestamp}-${randomSuffix}`;
}

function auditRequestFields(
  request?: RequestMetadata,
): Partial<Prisma.AuditLogUncheckedCreateInput> {
  if (!request) {
    return {};
  }

  return {
    ipAddress: request.ipAddress,
    userAgent: request.userAgent,
    requestId: request.requestId,
  };
}

function appointmentNotFoundError(): AppError {
  return new AppError(HTTP_STATUS.NOT_FOUND, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
}

function doctorNotFoundError(): AppError {
  return new AppError(HTTP_STATUS.NOT_FOUND, 'Doctor not found', 'DOCTOR_NOT_FOUND');
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

async function lockActiveDoctor(
  transaction: Prisma.TransactionClient,
  doctorId: string,
): Promise<void> {
  const lockedDoctors = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Doctor"
    WHERE "id" = ${doctorId}
    FOR UPDATE
  `;

  if (lockedDoctors.length === 0) {
    throw doctorNotFoundError();
  }

  const doctor = await transaction.doctor.findUniqueOrThrow({
    where: { id: doctorId },
    select: { status: true },
  });

  if (doctor.status !== 'ACTIVE') {
    throw new AppError(
      HTTP_STATUS.CONFLICT,
      'Appointments can only be booked with active doctors',
      'DOCTOR_NOT_ACTIVE',
    );
  }
}

export async function bookAppointment(
  input: BookAppointmentInput,
  request?: RequestMetadata,
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
        await lockActiveDoctor(transaction, parsed.doctorId);

        const patient = await transaction.patient.findUnique({
          where: { id: parsed.patientId },
          select: { id: true, status: true },
        });

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

        const slotAvailable = await isSlotAvailable(transaction, parsed.doctorId, {
          start: parsed.scheduledStart,
          end: parsed.scheduledEnd,
        });

        if (!slotAvailable) {
          throw appointmentSlotUnavailableError();
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
            ...auditRequestFields(request),
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
  request?: RequestMetadata,
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
          throw appointmentNotFoundError();
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

        await lockActiveDoctor(transaction, current.doctorId);

        const slotAvailable = await isSlotAvailable(
          transaction,
          current.doctorId,
          {
            start: parsed.scheduledStart,
            end: parsed.scheduledEnd,
          },
          current.id,
        );

        if (!slotAvailable) {
          throw appointmentSlotUnavailableError();
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
            },
            ...auditRequestFields(request),
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
  request?: RequestMetadata,
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
          throw appointmentNotFoundError();
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
            metadata: { source: 'appointment-service' },
            ...auditRequestFields(request),
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

export async function updateAppointmentStatus(
  input: AppointmentStatusUpdateInput,
  request?: RequestMetadata,
): Promise<AppointmentWithRelations> {
  const parsed = appointmentStatusUpdateSchema.parse(input);

  const appointmentId = await prisma.$transaction(async (transaction) => {
    const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Appointment"
      WHERE "id" = ${parsed.appointmentId}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      throw appointmentNotFoundError();
    }

    const current = await transaction.appointment.findUniqueOrThrow({
      where: { id: parsed.appointmentId },
    });

    if (current.status === parsed.status) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'The appointment is already in this status',
        'APPOINTMENT_STATUS_UNCHANGED',
      );
    }

    if (parsed.status === 'CANCELLED') {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'Use the appointment cancellation endpoint to cancel an appointment',
        'APPOINTMENT_CANCELLATION_REQUIRED',
      );
    }

    if (!STATUS_TRANSITIONS[current.status].includes(parsed.status)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        `Appointment status cannot transition from ${current.status} to ${parsed.status}`,
        'APPOINTMENT_STATUS_TRANSITION_INVALID',
      );
    }

    const updated = await transaction.appointment.update({
      where: { id: current.id },
      data: { status: parsed.status },
    });

    await transaction.auditLog.create({
      data: {
        actorUserId: parsed.actorUserId,
        action: 'APPOINTMENT_STATUS_CHANGED',
        entityType: 'Appointment',
        entityId: current.id,
        before: appointmentSnapshot(current),
        after: appointmentSnapshot(updated),
        metadata: { source: 'appointment-service' },
        ...auditRequestFields(request),
      },
    });

    return current.id;
  });

  return loadAppointment(appointmentId);
}

export async function getAppointment(
  appointmentId: string,
  actor: AuthenticatedUser,
): Promise<AppointmentWithRelations> {
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      ...(actor.role === 'CLINICIAN' ? { doctor: { userId: actor.id } } : {}),
    },
    include: appointmentInclude,
  });

  if (!appointment) {
    throw appointmentNotFoundError();
  }

  return appointment;
}

export async function listAppointments(
  query: AppointmentListQuery,
  actor: AuthenticatedUser,
): Promise<AppointmentListResult> {
  const where: Prisma.AppointmentWhereInput = {
    ...(query.patientId ? { patientId: query.patientId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? {
          scheduledStart: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            {
              appointmentNumber: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
            {
              patient: {
                is: {
                  firstName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            },
            {
              patient: {
                is: {
                  lastName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            },
            {
              patient: {
                is: {
                  patientNumber: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  if (actor.role === 'CLINICIAN') {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });

    if (!doctor) {
      return {
        appointments: [],
        pagination: paginationMeta(0, query.page, query.pageSize),
      };
    }

    if (query.doctorId && query.doctorId !== doctor.id) {
      throw doctorNotFoundError();
    }

    where.doctorId = doctor.id;
  } else if (query.doctorId) {
    where.doctorId = query.doctorId;
  }

  const [total, appointments] = await prisma.$transaction([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      ...paginationWindow(query.page, query.pageSize),
      orderBy: [{ scheduledStart: 'desc' }, { id: 'asc' }],
    }),
  ]);

  return {
    appointments,
    pagination: paginationMeta(total, query.page, query.pageSize),
  };
}
