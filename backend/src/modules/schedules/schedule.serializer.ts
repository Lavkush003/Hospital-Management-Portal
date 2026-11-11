import type { DoctorSchedule, DoctorScheduleBreak } from '@prisma/client';
import { serializeTimeOfDay } from '../../utils/validation';

type ScheduleBreakRecord = Pick<DoctorScheduleBreak, 'id' | 'startTime' | 'endTime'>;

type ScheduleRecord = Pick<
  DoctorSchedule,
  | 'id'
  | 'doctorId'
  | 'dayOfWeek'
  | 'startTime'
  | 'endTime'
  | 'slotDurationMinutes'
  | 'room'
  | 'isActive'
  | 'createdAt'
  | 'updatedAt'
> & {
  breaks: ScheduleBreakRecord[];
};

export function serializeScheduleBreak(scheduleBreak: ScheduleBreakRecord): unknown {
  return {
    id: scheduleBreak.id,
    startTime: serializeTimeOfDay(scheduleBreak.startTime),
    endTime: serializeTimeOfDay(scheduleBreak.endTime),
  };
}

export function serializeSchedule(schedule: ScheduleRecord): unknown {
  return {
    id: schedule.id,
    doctorId: schedule.doctorId,
    dayOfWeek: schedule.dayOfWeek,
    startTime: serializeTimeOfDay(schedule.startTime),
    endTime: serializeTimeOfDay(schedule.endTime),
    slotDurationMinutes: schedule.slotDurationMinutes,
    room: schedule.room,
    isActive: schedule.isActive,
    breaks: schedule.breaks.map(serializeScheduleBreak),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}
