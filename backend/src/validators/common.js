const { z } = require('zod');
const { GENDERS, BLOOD_GROUPS, APPOINTMENT_STATUS, APPOINTMENT_TYPE, GENDERS: _g } = require('../constants/enums');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid identifier');
const optionalObjectId = z.union([objectId, z.literal('')]).optional();
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');
const isoDate = z.coerce.date();
const email = z.string().email('Invalid email address');
const phone = z.string().min(6, 'Phone number is too short').max(30, 'Phone number is too long');

const paginationQuery = {
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  sortBy: z.string().max(60).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().trim().max(120).optional(),
};

const idParam = z.object({ id: objectId });

module.exports = {
  z,
  objectId,
  optionalObjectId,
  dateKey,
  timeString,
  isoDate,
  email,
  phone,
  paginationQuery,
  idParam,
  GENDERS,
  BLOOD_GROUPS,
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
};
