const { z, objectId, dateKey, timeString, paginationQuery, APPOINTMENT_STATUS, APPOINTMENT_TYPE } = require('./common');

const createAppointmentSchema = z.object({
  patient: objectId,
  doctor: objectId,
  date: dateKey,
  startTime: timeString,
  appointmentType: z.enum(Object.values(APPOINTMENT_TYPE)).optional().default('CONSULTATION'),
  reason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const rescheduleAppointmentSchema = z.object({
  date: dateKey,
  startTime: timeString,
  reason: z.string().trim().max(500).optional(),
});

const updateAppointmentSchema = z.object({
  appointmentType: z.enum(Object.values(APPOINTMENT_TYPE)).optional(),
  reason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(Object.values(APPOINTMENT_STATUS)),
  notes: z.string().trim().max(1000).optional(),
});

const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

const listAppointmentQuery = z.object({
  ...paginationQuery,
  status: z.enum(Object.values(APPOINTMENT_STATUS)).optional(),
  doctor: objectId.optional(),
  patient: objectId.optional(),
  department: objectId.optional(),
  date: dateKey.optional(),
  dateFrom: dateKey.optional(),
  dateTo: dateKey.optional(),
  upcomingOnly: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['createdAt', 'date', 'startTime']).optional(),
});

const appointmentIdParam = z.object({ id: objectId });

module.exports = {
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  updateAppointmentSchema,
  updateStatusSchema,
  cancelSchema,
  listAppointmentQuery,
  appointmentIdParam,
};
