export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple';

const success = new Set([
  'ACTIVE',
  'COMPLETED',
  'PAID',
  'SUCCESSFUL',
  'DISPENSED',
  'HEALTHY',
]);

const info = new Set([
  'SCHEDULED',
  'CONFIRMED',
  'ISSUED',
  'PROCESSING',
  'COLLECTED',
  'PLANNED',
  'IN_PROGRESS',
  'CHECKED_IN',
  'PARTIALLY_PAID',
]);

const warning = new Set(['ON_LEAVE', 'PENDING', 'ORDERED', 'OVERDUE', 'DRAFT']);

const danger = new Set([
  'CANCELLED',
  'NO_SHOW',
  'FAILED',
  'VOID',
  'SUSPENDED',
  'TERMINATED',
  'INACTIVE',
  'DECEASED',
  'REFUNDED',
]);

const purple = new Set(['ADMIN', 'CLINICIAN', 'PATIENT', 'FRONT_DESK', 'LABORATORY', 'IMAGING']);

export function statusTone(status: string | null | undefined): BadgeTone {
  if (!status) return 'neutral';
  const normalized = status.toUpperCase();
  if (success.has(normalized)) return 'success';
  if (info.has(normalized)) return 'info';
  if (warning.has(normalized)) return 'warning';
  if (danger.has(normalized)) return 'danger';
  if (purple.has(normalized)) return 'purple';
  return 'neutral';
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrator';
    case 'FRONT_DESK':
      return 'Front desk';
    case 'CLINICIAN':
      return 'Clinician';
    case 'PATIENT':
      return 'Patient';
    default:
      return role;
  }
}

export const appointmentStatuses = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export const visitStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export const invoiceStatuses = [
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'VOID',
  'OVERDUE',
  'REFUNDED',
] as const;

export const paymentMethods = [
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'MOBILE_MONEY',
  'INSURANCE',
  'OTHER',
] as const;

export const genders = ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'] as const;

export const bloodGroups = [
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
  'UNKNOWN',
] as const;

export const weekdays = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export function canTransitionAppointment(from: string, to: string): boolean {
  const transitions: Record<string, string[]> = {
    SCHEDULED: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
    CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
    CHECKED_IN: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
    IN_PROGRESS: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };
  return transitions[from]?.includes(to) ?? false;
}

export function canTransitionVisit(from: string, to: string): boolean {
  const transitions: Record<string, string[]> = {
    PLANNED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };
  return transitions[from]?.includes(to) ?? false;
}
