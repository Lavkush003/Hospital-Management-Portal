const { z, paginationQuery, optionalObjectId } = require('./common');

const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(20),
  description: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  head: optionalObjectId,
});

const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const listDepartmentQuery = z.object({
  ...paginationQuery,
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortBy: z.enum(['createdAt', 'name', 'code']).optional(),
});

module.exports = { createDepartmentSchema, updateDepartmentSchema, listDepartmentQuery };
