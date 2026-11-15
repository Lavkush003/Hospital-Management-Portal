const { z, objectId, optionalObjectId, paginationQuery, isoDate } = require('./common');

const vitalSignsSchema = z
  .object({
    temperatureC: z.coerce.number().min(25).max(45).optional(),
    bloodPressure: z.string().trim().max(20).optional(),
    heartRate: z.coerce.number().min(20).max(300).optional(),
    weightKg: z.coerce.number().min(0.5).max(500).optional(),
    heightCm: z.coerce.number().min(20).max(260).optional(),
    oxygenSaturation: z.coerce.number().min(0).max(100).optional(),
  })
  .optional();

const createEncounterSchema = z.object({
  patient: objectId,
  doctor: optionalObjectId,
  appointment: optionalObjectId,
  encounterDate: isoDate.optional(),
  visitType: z.enum(['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY']).optional().default('CONSULTATION'),
  chiefComplaint: z.string().trim().min(1).max(1000),
  clinicalNotes: z.string().trim().max(10000).optional(),
  vitalSigns: vitalSignsSchema,
  treatmentNotes: z.string().trim().max(10000).optional(),
  followUpDate: z.union([isoDate, z.literal('')]).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional().default('OPEN'),
});

const updateEncounterSchema = createEncounterSchema
  .omit({ patient: true, doctor: true, appointment: true })
  .partial()
  .extend({ clinicalNotes: z.string().trim().max(10000).optional() });

const listEncounterQuery = z.object({
  ...paginationQuery,
  patient: objectId.optional(),
  doctor: objectId.optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['createdAt', 'encounterDate']).optional(),
});

module.exports = { createEncounterSchema, updateEncounterSchema, listEncounterQuery };
