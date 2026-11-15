const { z, email, phone, optionalObjectId, paginationQuery, isoDate } = require('./common');

const createStaffSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email,
  phone: phone.optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'RECEPTIONIST']),
  department: optionalObjectId,
  jobTitle: z.string().trim().min(1).max(120),
  joiningDate: isoDate.optional(),
  password: z.string().min(8).max(128).optional(),
});

const updateStaffSchema = createStaffSchema.partial().extend({
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED']).optional(),
});

const updateStaffStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED']),
});

const listStaffQuery = z.object({
  ...paginationQuery,
  department: optionalObjectId,
  role: z.enum(['ADMIN', 'RECEPTIONIST']).optional(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED']).optional(),
  sortBy: z.enum(['createdAt', 'firstName', 'lastName']).optional(),
});

module.exports = { createStaffSchema, updateStaffSchema, updateStaffStatusSchema, listStaffQuery };
