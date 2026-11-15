const { z, email, phone, objectId, paginationQuery, timeString } = require('./common');

const workingHoursSchema = z.object({
  start: timeString,
  end: timeString,
});

const createDoctorSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email,
  phone: phone.optional().or(z.literal('')),
  department: objectId,
  specialization: z.string().trim().min(1).max(120),
  qualification: z.string().trim().min(1).max(200),
  experienceYears: z.coerce.number().min(0).max(70).optional().default(0),
  consultationFee: z.coerce.number().min(0).max(1000000).optional().default(0),
  workingDays: z.array(z.coerce.number().int().min(0).max(6)).min(1).optional(),
  workingHours: workingHoursSchema.optional(),
  appointmentDuration: z.coerce.number().int().min(10).max(120).optional().default(30),
  bio: z.string().trim().max(1000).optional(),
  password: z.string().min(8).max(128).optional(),
});

const updateDoctorSchema = createDoctorSchema.partial();

const updateDoctorStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE']),
});

const listDoctorQuery = z.object({
  ...paginationQuery,
  department: objectId.optional(),
  specialization: z.string().trim().max(120).optional(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE']).optional(),
  sortBy: z.enum(['createdAt', 'firstName', 'lastName', 'consultationFee', 'experienceYears']).optional(),
});

const availabilityQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
});

module.exports = {
  createDoctorSchema,
  updateDoctorSchema,
  updateDoctorStatusSchema,
  listDoctorQuery,
  availabilityQuery,
};
