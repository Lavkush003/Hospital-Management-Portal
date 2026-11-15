const { z, objectId, optionalObjectId, paginationQuery, isoDate } = require('./common');

const medicineSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().min(1).max(100),
  frequency: z.string().trim().min(1).max(100),
  duration: z.string().trim().min(1).max(100),
  instructions: z.string().trim().max(500).optional(),
});

const createPrescriptionSchema = z.object({
  patient: objectId,
  doctor: optionalObjectId,
  encounter: objectId,
  prescriptionDate: isoDate.optional(),
  medicines: z.array(medicineSchema).min(1, 'At least one medicine is required').max(30),
  notes: z.string().trim().max(2000).optional(),
});

const updatePrescriptionSchema = z.object({
  medicines: z.array(medicineSchema).min(1).max(30).optional(),
  notes: z.string().trim().max(2000).optional(),
  prescriptionDate: isoDate.optional(),
});

const listPrescriptionQuery = z.object({
  ...paginationQuery,
  patient: objectId.optional(),
  doctor: objectId.optional(),
  encounter: objectId.optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['createdAt', 'prescriptionDate']).optional(),
});

module.exports = { createPrescriptionSchema, updatePrescriptionSchema, listPrescriptionQuery };
