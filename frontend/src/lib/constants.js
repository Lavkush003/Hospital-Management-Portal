export const ROLES = { ADMIN: 'ADMIN', RECEPTIONIST: 'RECEPTIONIST', DOCTOR: 'DOCTOR' };

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'];

export const BLOOD_GROUPS = [
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
  'UNKNOWN',
];

export const BLOOD_GROUP_LABELS = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A-',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B-',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB-',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O-',
  UNKNOWN: 'Unknown',
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const APPOINTMENT_STATUSES = [
  'BOOKED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

export const APPOINTMENT_TYPES = ['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY'];

export const APPOINTMENT_TRANSITIONS = {
  BOOKED: ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export const ENCOUNTER_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const VISIT_TYPES = ['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY'];
export const REPORT_STATUSES = ['ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const REPORT_CATEGORIES = ['Laboratory', 'Radiology', 'Cardiology', 'Pathology', 'Imaging', 'Other'];

export const INVOICE_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'CANCELLED'];
export const PAYMENT_STATUSES = ['SUCCESS', 'FAILED', 'REFUNDED'];
export const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'INSURANCE', 'OTHER'];
export const LINE_ITEM_CATEGORIES = ['CONSULTATION', 'DIAGNOSTIC', 'PROCEDURE', 'MEDICINE', 'OTHER'];

export const ROLE_LABELS = {
  ADMIN: 'Administrator',
  RECEPTIONIST: 'Receptionist',
  DOCTOR: 'Doctor',
};

export const STATUS_TONES = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  INACTIVE: 'neutral',
  TERMINATED: 'danger',
  BOOKED: 'info',
  CONFIRMED: 'info',
  CHECKED_IN: 'warning',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
  OPEN: 'info',
  ORDERED: 'info',
  UNPAID: 'warning',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  REFUNDED: 'neutral',
  SUCCESS: 'success',
  FAILED: 'danger',
  MALE: 'info',
  FEMALE: 'purple',
  OTHER: 'neutral',
};
