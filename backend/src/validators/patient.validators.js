const { z, isoDate, email, phone, paginationQuery, objectId, GENDERS, BLOOD_GROUPS } = require('./common');

const addressSchema = z
  .object({
    line1: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
  })
  .optional();

const emergencySchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(30).optional(),
    relationship: z.string().trim().max(60).optional(),
  })
  .optional();

const createPatientSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: isoDate.refine((date) => date <= new Date(), 'Date of birth cannot be in the future'),
  gender: z.enum(GENDERS),
  phone,
  email: email.optional().or(z.literal('')),
  address: addressSchema,
  emergencyContact: emergencySchema,
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
});

const updatePatientSchema = createPatientSchema.partial();

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

const listPatientQuery = z.object({
  ...paginationQuery,
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  sortBy: z.enum(['createdAt', 'firstName', 'lastName', 'registrationDate', 'patientId']).optional(),
});

const patientIdParam = z.object({ id: objectId });

module.exports = {
  createPatientSchema,
  updatePatientSchema,
  updateStatusSchema,
  listPatientQuery,
  patientIdParam,
};
