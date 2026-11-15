const { z, objectId, timeString, paginationQuery } = require('./common');

const createScheduleSchema = z
  .object({
    doctor: objectId,
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: timeString,
    endTime: timeString,
    slotDuration: z.coerce.number().int().min(10).max(120).optional().default(30),
    room: z.string().trim().max(80).optional(),
    isActive: z.boolean().optional().default(true),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: 'Start time must be before end time',
    path: ['endTime'],
  });

const updateScheduleSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
    startTime: timeString.optional(),
    endTime: timeString.optional(),
    slotDuration: z.coerce.number().int().min(10).max(120).optional(),
    room: z.string().trim().max(80).optional(),
    isActive: z.boolean().optional(),
  })
  .partial();

const listScheduleQuery = z.object({
  ...paginationQuery,
  doctor: objectId.optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
});

module.exports = { createScheduleSchema, updateScheduleSchema, listScheduleQuery };
