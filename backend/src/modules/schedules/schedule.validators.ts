import { z } from 'zod';
import {
  availabilityRangeSchema,
  isoDateTimeSchema,
  paginationSchema,
  timeOfDaySchema,
} from '../../utils/validation';

const dayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

const scheduleBreakSchema = z
  .object({
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
  })
  .strict();

const scheduleBreakTimesSchema = z.array(scheduleBreakSchema).max(20);

export const scheduleCreateSchema = z
  .object({
    dayOfWeek: dayOfWeekSchema,
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
    slotDurationMinutes: z.coerce.number().int().min(5).max(240).default(30),
    breakTimes: scheduleBreakTimesSchema.default([]),
    room: z.string().trim().min(1).max(50).optional(),
    isActive: z.boolean().default(true),
  })
  .strict();

export const scheduleUpdateSchema = z
  .object({
    dayOfWeek: dayOfWeekSchema.optional(),
    startTime: timeOfDaySchema.optional(),
    endTime: timeOfDaySchema.optional(),
    slotDurationMinutes: z.coerce.number().int().min(5).max(240).optional(),
    breakTimes: scheduleBreakTimesSchema.optional(),
    room: z.string().trim().min(1).max(50).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one schedule field must be provided',
  });

const timeRangeSchema = z
  .object({
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
  })
  .refine((value) => value.endAt > value.startAt, {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });

export const leaveCreateSchema = timeRangeSchema
  .extend({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const unavailabilityCreateSchema = timeRangeSchema
  .extend({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

const timeRangeListQuerySchema = paginationSchema
  .extend({
    start: isoDateTimeSchema.optional(),
    end: isoDateTimeSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.start === undefined || value.end === undefined || value.end > value.start,
    {
      message: 'end must be after start',
      path: ['end'],
    },
  );

export const leaveListQuerySchema = timeRangeListQuerySchema;
export const unavailabilityListQuerySchema = timeRangeListQuerySchema;
export const doctorAvailabilityQuerySchema = availabilityRangeSchema;

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;
export type LeaveCreateInput = z.infer<typeof leaveCreateSchema>;
export type UnavailabilityCreateInput = z.infer<typeof unavailabilityCreateSchema>;
export type LeaveListQuery = z.infer<typeof leaveListQuerySchema>;
export type UnavailabilityListQuery = z.infer<typeof unavailabilityListQuerySchema>;
export type DoctorAvailabilityQuery = z.infer<typeof doctorAvailabilityQuerySchema>;
