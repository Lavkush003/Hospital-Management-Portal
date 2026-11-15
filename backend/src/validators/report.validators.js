const { z, objectId, optionalObjectId, paginationQuery, isoDate } = require('./common');

const createReportSchema = z.object({
  patient: objectId,
  doctor: optionalObjectId,
  encounter: optionalObjectId,
  testName: z.string().trim().min(1).max(200),
  testCategory: z.string().trim().min(1).max(120),
  reportDate: isoDate.optional(),
  status: z.enum(['ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional().default('ORDERED'),
  notes: z.string().trim().max(5000).optional(),
  fileReference: z.string().trim().max(500).optional(),
});

const updateReportSchema = createReportSchema
  .omit({ patient: true, doctor: true, encounter: true })
  .partial();

const listReportQuery = z.object({
  ...paginationQuery,
  patient: objectId.optional(),
  doctor: objectId.optional(),
  encounter: objectId.optional(),
  status: z.enum(['ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  testCategory: z.string().trim().max(120).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['createdAt', 'reportDate']).optional(),
});

module.exports = { createReportSchema, updateReportSchema, listReportQuery };
