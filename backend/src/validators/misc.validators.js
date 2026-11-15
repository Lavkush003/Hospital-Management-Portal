const { z, paginationQuery, objectId } = require('./common');

const auditQuery = z.object({
  ...paginationQuery,
  action: z.string().trim().max(120).optional(),
  resourceType: z.string().trim().max(120).optional(),
  actor: objectId.optional(),
  outcome: z.enum(['SUCCESS', 'FAILURE']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['createdAt']).optional(),
});

const reportQuery = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  department: objectId.optional(),
  doctor: objectId.optional(),
});

const patientHistoryQuery = z.object({
  ...paginationQuery,
});

module.exports = { auditQuery, reportQuery, patientHistoryQuery };
