import type { DayOfWeek, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import {
  addMinutes,
  atUtcTime,
  paginationMeta,
  paginationWindow,
  utcDayStart,
  type PaginationMeta,
} from '../../utils/validation';
import { doctorNotFoundError } from '../doctors/doctor.service';

const DAY_IN_MILLISECONDS = 86_400_000;
const DAYS_BY_UTC_INDEX: DayOfWeek[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

type AvailabilityClient = Pick<Prisma.TransactionClient, 'doctor' | 'appointment'>;

interface TimeRange {
  start: Date;
  end: Date;
}

export interface AvailabilitySlot {
  start: Date;
  end: Date;
}

interface DoctorAvailabilityRecord {
  id: string;
  status: string;
  schedules: Array<{
    dayOfWeek: DayOfWeek;
    startTime: Date;
    endTime: Date;
    slotDurationMinutes: number;
    breaks: Array<{ startTime: Date; endTime: Date }>;
  }>;
  leaves: Array<{ startAt: Date; endAt: Date }>;
  unavailability: Array<{ startAt: Date; endAt: Date }>;
}

interface AvailableDoctorQuery {
  start: Date;
  end: Date;
  search?: string;
  departmentId?: string;
  specialization?: string;
  page: number;
  pageSize: number;
}

export interface AvailableDoctor {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  specialization: string;
  qualifications: string | null;
  consultationFee: unknown;
  status: string;
  bio: string | null;
  department: unknown;
  availableSlotCount: number;
  nextAvailableSlot: Date | null;
}

export interface AvailableDoctorResult {
  doctors: AvailableDoctor[];
  pagination: PaginationMeta;
  range: TimeRange;
}

function overlaps(rangeStart: Date, rangeEnd: Date, blockStart: Date, blockEnd: Date): boolean {
  return rangeStart < blockEnd && rangeEnd > blockStart;
}

async function loadDoctorAvailability(
  client: AvailabilityClient,
  doctorId: string,
  range: TimeRange,
): Promise<DoctorAvailabilityRecord> {
  const doctor = await client.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      status: true,
      schedules: {
        where: { isActive: true },
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          slotDurationMinutes: true,
          breaks: {
            select: { startTime: true, endTime: true },
          },
        },
      },
      leaves: {
        where: {
          startAt: { lt: range.end },
          endAt: { gt: range.start },
        },
        select: { startAt: true, endAt: true },
      },
      unavailability: {
        where: {
          startAt: { lt: range.end },
          endAt: { gt: range.start },
        },
        select: { startAt: true, endAt: true },
      },
    },
  });

  if (!doctor) {
    throw doctorNotFoundError();
  }

  return doctor;
}

async function generateAvailabilitySlots(
  client: AvailabilityClient,
  doctorId: string,
  range: TimeRange,
  excludeAppointmentId?: string,
): Promise<AvailabilitySlot[]> {
  const doctor = await loadDoctorAvailability(client, doctorId, range);

  if (doctor.status !== 'ACTIVE') {
    return [];
  }

  const appointments = await client.appointment.findMany({
    where: {
      doctorId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      scheduledStart: { lt: range.end },
      scheduledEnd: { gt: range.start },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { scheduledStart: true, scheduledEnd: true },
  });

  const slots = new Map<string, AvailabilitySlot>();
  const lastDay = utcDayStart(range.end);
  let day = utcDayStart(range.start);

  while (day.getTime() <= lastDay.getTime()) {
    const dayOfWeek = DAYS_BY_UTC_INDEX[day.getUTCDay()];

    for (const schedule of doctor.schedules) {
      if (schedule.dayOfWeek !== dayOfWeek) {
        continue;
      }

      const workStart = atUtcTime(day, schedule.startTime);
      const workEnd = atUtcTime(day, schedule.endTime);
      const breaks = schedule.breaks.map((scheduleBreak) => ({
        start: atUtcTime(day, scheduleBreak.startTime),
        end: atUtcTime(day, scheduleBreak.endTime),
      }));

      for (
        let slotStart = workStart;
        slotStart.getTime() + schedule.slotDurationMinutes * 60_000 <= workEnd.getTime();
        slotStart = addMinutes(slotStart, schedule.slotDurationMinutes)
      ) {
        const slotEnd = addMinutes(slotStart, schedule.slotDurationMinutes);

        if (slotStart < range.start || slotEnd > range.end) {
          continue;
        }

        if (
          breaks.some((scheduleBreak) =>
            overlaps(slotStart, slotEnd, scheduleBreak.start, scheduleBreak.end),
          )
        ) {
          continue;
        }

        if (
          doctor.leaves.some((leave) => overlaps(slotStart, slotEnd, leave.startAt, leave.endAt)) ||
          doctor.unavailability.some((period) =>
            overlaps(slotStart, slotEnd, period.startAt, period.endAt),
          )
        ) {
          continue;
        }

        if (
          appointments.some((appointment) =>
            overlaps(slotStart, slotEnd, appointment.scheduledStart, appointment.scheduledEnd),
          )
        ) {
          continue;
        }

        slots.set(`${slotStart.getTime()}:${slotEnd.getTime()}`, {
          start: slotStart,
          end: slotEnd,
        });
      }
    }

    day = new Date(day.getTime() + DAY_IN_MILLISECONDS);
  }

  return [...slots.values()].sort((left, right) => left.start.getTime() - right.start.getTime());
}

export async function getDoctorAvailability(
  doctorId: string,
  range: TimeRange,
): Promise<{ doctorId: string; range: TimeRange; slots: AvailabilitySlot[] }> {
  const slots = await getAvailableSlots(doctorId, range);

  return { doctorId, range, slots };
}

export async function getAvailableSlots(
  doctorId: string,
  range: TimeRange,
  excludeAppointmentId?: string,
): Promise<AvailabilitySlot[]> {
  return generateAvailabilitySlots(prisma, doctorId, range, excludeAppointmentId);
}

export async function isSlotAvailable(
  client: Prisma.TransactionClient,
  doctorId: string,
  slot: TimeRange,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const slots = await generateAvailabilitySlots(client, doctorId, slot, excludeAppointmentId);

  return slots.some(
    (candidate) =>
      candidate.start.getTime() === slot.start.getTime() &&
      candidate.end.getTime() === slot.end.getTime(),
  );
}

export function appointmentSlotUnavailableError(): AppError {
  return new AppError(
    HTTP_STATUS.CONFLICT,
    'The requested appointment slot is not available',
    'APPOINTMENT_SLOT_UNAVAILABLE',
  );
}

export async function listAvailableDoctors(
  query: AvailableDoctorQuery,
): Promise<AvailableDoctorResult> {
  const where: Prisma.DoctorWhereInput = {
    status: 'ACTIVE',
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.specialization
      ? {
          specialization: {
            contains: query.specialization,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            {
              firstName: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
            {
              lastName: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
            {
              specialization: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
            {
              employeeCode: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {}),
  };

  const doctors = await prisma.doctor.findMany({
    where,
    include: {
      department: {
        select: {
          id: true,
          code: true,
          name: true,
          location: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    take: 500,
  });

  const availableDoctors: AvailableDoctor[] = [];

  for (const doctor of doctors) {
    const slots = await getAvailableSlots(doctor.id, query);
    const nextSlot = slots[0];

    if (nextSlot) {
      availableDoctors.push({
        id: doctor.id,
        employeeCode: doctor.employeeCode,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        email: doctor.email,
        phone: doctor.phone,
        specialization: doctor.specialization,
        qualifications: doctor.qualifications,
        consultationFee: doctor.consultationFee,
        status: doctor.status,
        bio: doctor.bio,
        department: doctor.department,
        availableSlotCount: slots.length,
        nextAvailableSlot: nextSlot.start,
      });
    }
  }

  const window = paginationWindow(query.page, query.pageSize);
  const paginated = availableDoctors.slice(window.skip, window.skip + window.take);

  return {
    doctors: paginated,
    pagination: paginationMeta(availableDoctors.length, query.page, query.pageSize),
    range: { start: query.start, end: query.end },
  };
}
