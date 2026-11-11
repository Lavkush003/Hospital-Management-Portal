import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { isUniqueConstraintError } from '../../utils/database-errors';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import {
  minutesSinceMidnight,
  paginationMeta,
  paginationWindow,
  type PaginationMeta,
} from '../../utils/validation';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import { serializeSchedule } from './schedule.serializer';
import type {
  LeaveCreateInput,
  LeaveListQuery,
  ScheduleCreateInput,
  ScheduleUpdateInput,
  UnavailabilityCreateInput,
  UnavailabilityListQuery,
} from './schedule.validators';

const scheduleInclude = {
  breaks: {
    select: { id: true, startTime: true, endTime: true },
    orderBy: { startTime: 'asc' as const },
  },
} satisfies Prisma.DoctorScheduleInclude;

type ScheduleWithBreaks = Prisma.DoctorScheduleGetPayload<{
  include: typeof scheduleInclude;
}>;

interface TimeRangeInput {
  startTime: Date;
  endTime: Date;
}

interface ScheduleShape {
  startTime: Date;
  endTime: Date;
  slotDurationMinutes: number;
  breakTimes: TimeRangeInput[];
}

export function scheduleNotFoundError(): AppError {
  return new AppError(HTTP_STATUS.NOT_FOUND, 'Doctor schedule not found', 'SCHEDULE_NOT_FOUND');
}

function validateScheduleShape(shape: ScheduleShape): void {
  const startMinutes = minutesSinceMidnight(shape.startTime);
  const endMinutes = minutesSinceMidnight(shape.endTime);

  if (endMinutes <= startMinutes) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'Schedule endTime must be after startTime',
      'SCHEDULE_TIME_INVALID',
    );
  }

  if (shape.slotDurationMinutes > endMinutes - startMinutes) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'slotDurationMinutes cannot exceed the schedule window',
      'SCHEDULE_DURATION_INVALID',
    );
  }

  const sortedBreaks = [...shape.breakTimes].sort(
    (left, right) => left.startTime.getTime() - right.startTime.getTime(),
  );

  let previousBreakEnd = -1;

  for (const scheduleBreak of sortedBreaks) {
    const breakStart = minutesSinceMidnight(scheduleBreak.startTime);
    const breakEnd = minutesSinceMidnight(scheduleBreak.endTime);

    if (breakEnd <= breakStart) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        'Break endTime must be after startTime',
        'SCHEDULE_BREAK_TIME_INVALID',
      );
    }

    if (breakStart < startMinutes || breakEnd > endMinutes) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        'Breaks must be fully inside the schedule window',
        'SCHEDULE_BREAK_OUT_OF_BOUNDS',
      );
    }

    if (breakStart < previousBreakEnd) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        'Schedule breaks must not overlap',
        'SCHEDULE_BREAK_OVERLAP',
      );
    }

    previousBreakEnd = breakEnd;
  }
}

function mapScheduleWriteError(error: unknown): unknown {
  if (isUniqueConstraintError(error)) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'A schedule already exists for this doctor, day, and start time',
      'SCHEDULE_CONFLICT',
    );
  }

  return error;
}

async function lockDoctor(
  transaction: Prisma.TransactionClient,
  doctorId: string,
): Promise<{ id: string }> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Doctor"
    WHERE "id" = ${doctorId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, 'Doctor not found', 'DOCTOR_NOT_FOUND');
  }

  return rows[0] as { id: string };
}

async function lockSchedule(
  transaction: Prisma.TransactionClient,
  doctorId: string,
  scheduleId: string,
): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "DoctorSchedule"
    WHERE "id" = ${scheduleId}
      AND "doctorId" = ${doctorId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw scheduleNotFoundError();
  }
}

async function assertDoctorReadable(doctorId: string, actor: AuthenticatedUser): Promise<void> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true, userId: true },
  });

  if (!doctor || (actor.role === 'CLINICIAN' && doctor.userId !== actor.id)) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, 'Doctor not found', 'DOCTOR_NOT_FOUND');
  }
}

function scheduleSnapshot(schedule: ScheduleWithBreaks): Prisma.InputJsonObject {
  return {
    doctorId: schedule.doctorId,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime.toISOString(),
    endTime: schedule.endTime.toISOString(),
    slotDurationMinutes: schedule.slotDurationMinutes,
    room: schedule.room,
    isActive: schedule.isActive,
    breaks: schedule.breaks.map((item) => ({
      id: item.id,
      startTime: item.startTime.toISOString(),
      endTime: item.endTime.toISOString(),
    })),
  };
}

export async function getDoctorSchedule(
  doctorId: string,
  actor: AuthenticatedUser,
): Promise<unknown> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      specialization: true,
      status: true,
      schedules: {
        include: scheduleInclude,
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  });

  if (!doctor || (actor.role === 'CLINICIAN' && doctor.userId !== actor.id)) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, 'Doctor not found', 'DOCTOR_NOT_FOUND');
  }

  return {
    ...doctor,
    schedules: doctor.schedules.map((schedule) => serializeSchedule(schedule)),
  };
}

export async function listDoctorSchedules(
  doctorId: string,
  actor: AuthenticatedUser,
): Promise<unknown> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      specialization: true,
      status: true,
      schedules: {
        include: scheduleInclude,
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  });

  if (!doctor || (actor.role === 'CLINICIAN' && doctor.userId !== actor.id)) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, 'Doctor not found', 'DOCTOR_NOT_FOUND');
  }

  return {
    doctor: {
      id: doctor.id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      specialization: doctor.specialization,
      status: doctor.status,
    },
    schedules: doctor.schedules.map((schedule) => serializeSchedule(schedule)),
  };
}

export async function createSchedule(
  doctorId: string,
  input: ScheduleCreateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  validateScheduleShape(input);

  try {
    const schedule = await prisma.$transaction(async (transaction) => {
      await lockDoctor(transaction, doctorId);

      const created = await transaction.doctorSchedule.create({
        data: {
          doctorId,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
          slotDurationMinutes: input.slotDurationMinutes,
          room: input.room ?? null,
          isActive: input.isActive,
          breaks: {
            create: input.breakTimes.map((scheduleBreak) => ({
              startTime: scheduleBreak.startTime,
              endTime: scheduleBreak.endTime,
            })),
          },
        },
        include: scheduleInclude,
      });

      await writeAuditLog(
        {
          actorUserId,
          action: 'DOCTOR_SCHEDULE_CREATED',
          entityType: 'DoctorSchedule',
          entityId: created.id,
          after: scheduleSnapshot(created),
          metadata: { doctorId },
          request,
        },
        transaction,
      );

      return created;
    });

    return serializeSchedule(schedule);
  } catch (error) {
    throw mapScheduleWriteError(error);
  }
}

export async function updateSchedule(
  doctorId: string,
  scheduleId: string,
  input: ScheduleUpdateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  try {
    const schedule = await prisma.$transaction(async (transaction) => {
      await lockDoctor(transaction, doctorId);
      await lockSchedule(transaction, doctorId, scheduleId);

      const current = await transaction.doctorSchedule.findUniqueOrThrow({
        where: { id: scheduleId },
        include: scheduleInclude,
      });

      const nextShape: ScheduleShape = {
        startTime: input.startTime ?? current.startTime,
        endTime: input.endTime ?? current.endTime,
        slotDurationMinutes: input.slotDurationMinutes ?? current.slotDurationMinutes,
        breakTimes:
          input.breakTimes ??
          current.breaks.map((item) => ({
            startTime: item.startTime,
            endTime: item.endTime,
          })),
      };

      validateScheduleShape(nextShape);

      const updated = await transaction.doctorSchedule.update({
        where: { id: scheduleId },
        data: {
          ...(input.dayOfWeek === undefined ? {} : { dayOfWeek: input.dayOfWeek }),
          ...(input.startTime === undefined ? {} : { startTime: input.startTime }),
          ...(input.endTime === undefined ? {} : { endTime: input.endTime }),
          ...(input.slotDurationMinutes === undefined
            ? {}
            : { slotDurationMinutes: input.slotDurationMinutes }),
          ...(input.room === undefined ? {} : { room: input.room }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
          ...(input.breakTimes === undefined
            ? {}
            : {
                breaks: {
                  deleteMany: {},
                  create: input.breakTimes.map((scheduleBreak) => ({
                    startTime: scheduleBreak.startTime,
                    endTime: scheduleBreak.endTime,
                  })),
                },
              }),
        },
        include: scheduleInclude,
      });

      await writeAuditLog(
        {
          actorUserId,
          action: 'DOCTOR_SCHEDULE_UPDATED',
          entityType: 'DoctorSchedule',
          entityId: scheduleId,
          before: scheduleSnapshot(current),
          after: scheduleSnapshot(updated),
          metadata: { doctorId },
          request,
        },
        transaction,
      );

      return updated;
    });

    return serializeSchedule(schedule);
  } catch (error) {
    throw mapScheduleWriteError(error);
  }
}

export async function deleteSchedule(
  doctorId: string,
  scheduleId: string,
  actorUserId: string,
  request: RequestMetadata,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await lockDoctor(transaction, doctorId);
    await lockSchedule(transaction, doctorId, scheduleId);

    const current = await transaction.doctorSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
      include: scheduleInclude,
    });

    await transaction.doctorSchedule.delete({ where: { id: scheduleId } });

    await writeAuditLog(
      {
        actorUserId,
        action: 'DOCTOR_SCHEDULE_DELETED',
        entityType: 'DoctorSchedule',
        entityId: scheduleId,
        before: scheduleSnapshot(current),
        metadata: { doctorId },
        request,
      },
      transaction,
    );
  });
}

export async function listDoctorLeaves(
  doctorId: string,
  query: LeaveListQuery,
  actor: AuthenticatedUser,
): Promise<{ leaves: unknown[]; pagination: PaginationMeta }> {
  await assertDoctorReadable(doctorId, actor);

  const where: Prisma.DoctorLeaveWhereInput = {
    doctorId,
    ...(query.start ? { endAt: { gt: query.start } } : {}),
    ...(query.end ? { startAt: { lt: query.end } } : {}),
  };

  const [total, leaves] = await prisma.$transaction([
    prisma.doctorLeave.count({ where }),
    prisma.doctorLeave.findMany({
      where,
      ...paginationWindow(query.page, query.pageSize),
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  return {
    leaves,
    pagination: paginationMeta(total, query.page, query.pageSize),
  };
}

export async function createLeave(
  doctorId: string,
  input: LeaveCreateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  return prisma.$transaction(async (transaction) => {
    await lockDoctor(transaction, doctorId);

    const overlap = await transaction.doctorLeave.findFirst({
      where: {
        doctorId,
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt },
      },
      select: { id: true, startAt: true, endAt: true },
    });

    if (overlap) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'This leave overlaps an existing leave period',
        'DOCTOR_LEAVE_OVERLAP',
      );
    }

    const leave = await transaction.doctorLeave.create({
      data: {
        doctorId,
        startAt: input.startAt,
        endAt: input.endAt,
        reason: input.reason ?? null,
      },
    });

    await writeAuditLog(
      {
        actorUserId,
        action: 'DOCTOR_LEAVE_CREATED',
        entityType: 'DoctorLeave',
        entityId: leave.id,
        after: {
          doctorId,
          startAt: leave.startAt.toISOString(),
          endAt: leave.endAt.toISOString(),
          reason: leave.reason,
        },
        request,
      },
      transaction,
    );

    return leave;
  });
}

export async function deleteLeave(
  doctorId: string,
  leaveId: string,
  actorUserId: string,
  request: RequestMetadata,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await lockDoctor(transaction, doctorId);

    const leave = await transaction.doctorLeave.findFirst({
      where: { id: leaveId, doctorId },
    });

    if (!leave) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Doctor leave not found', 'DOCTOR_LEAVE_NOT_FOUND');
    }

    await transaction.doctorLeave.delete({ where: { id: leaveId } });

    await writeAuditLog(
      {
        actorUserId,
        action: 'DOCTOR_LEAVE_DELETED',
        entityType: 'DoctorLeave',
        entityId: leaveId,
        before: {
          doctorId,
          startAt: leave.startAt.toISOString(),
          endAt: leave.endAt.toISOString(),
          reason: leave.reason,
        },
        request,
      },
      transaction,
    );
  });
}

export async function listDoctorUnavailability(
  doctorId: string,
  query: UnavailabilityListQuery,
  actor: AuthenticatedUser,
): Promise<{ unavailability: unknown[]; pagination: PaginationMeta }> {
  await assertDoctorReadable(doctorId, actor);

  const where: Prisma.DoctorUnavailabilityWhereInput = {
    doctorId,
    ...(query.start ? { endAt: { gt: query.start } } : {}),
    ...(query.end ? { startAt: { lt: query.end } } : {}),
  };

  const [total, unavailability] = await prisma.$transaction([
    prisma.doctorUnavailability.count({ where }),
    prisma.doctorUnavailability.findMany({
      where,
      ...paginationWindow(query.page, query.pageSize),
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  return {
    unavailability,
    pagination: paginationMeta(total, query.page, query.pageSize),
  };
}

export async function createUnavailability(
  doctorId: string,
  input: UnavailabilityCreateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  return prisma.$transaction(async (transaction) => {
    await lockDoctor(transaction, doctorId);

    const overlap = await transaction.doctorUnavailability.findFirst({
      where: {
        doctorId,
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt },
      },
      select: { id: true },
    });

    if (overlap) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'This period overlaps an existing unavailability period',
        'DOCTOR_UNAVAILABILITY_OVERLAP',
      );
    }

    const unavailability = await transaction.doctorUnavailability.create({
      data: {
        doctorId,
        startAt: input.startAt,
        endAt: input.endAt,
        reason: input.reason ?? null,
      },
    });

    await writeAuditLog(
      {
        actorUserId,
        action: 'DOCTOR_UNAVAILABILITY_CREATED',
        entityType: 'DoctorUnavailability',
        entityId: unavailability.id,
        after: {
          doctorId,
          startAt: unavailability.startAt.toISOString(),
          endAt: unavailability.endAt.toISOString(),
          reason: unavailability.reason,
        },
        request,
      },
      transaction,
    );

    return unavailability;
  });
}

export async function deleteUnavailability(
  doctorId: string,
  unavailabilityId: string,
  actorUserId: string,
  request: RequestMetadata,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await lockDoctor(transaction, doctorId);

    const unavailability = await transaction.doctorUnavailability.findFirst({
      where: { id: unavailabilityId, doctorId },
    });

    if (!unavailability) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        'Doctor unavailability period not found',
        'DOCTOR_UNAVAILABILITY_NOT_FOUND',
      );
    }

    await transaction.doctorUnavailability.delete({
      where: { id: unavailabilityId },
    });

    await writeAuditLog(
      {
        actorUserId,
        action: 'DOCTOR_UNAVAILABILITY_DELETED',
        entityType: 'DoctorUnavailability',
        entityId: unavailabilityId,
        before: {
          doctorId,
          startAt: unavailability.startAt.toISOString(),
          endAt: unavailability.endAt.toISOString(),
          reason: unavailability.reason,
        },
        request,
      },
      transaction,
    );
  });
}
