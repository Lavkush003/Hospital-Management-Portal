import type { UserRole } from '@prisma/client';

export const PERMISSIONS = {
  USERS_MANAGE: 'users:manage',
  PATIENTS_CREATE: 'patients:create',
  PATIENTS_READ: 'patients:read',
  PATIENTS_UPDATE: 'patients:update',
  PATIENTS_CLINICAL_READ: 'patients:clinical:read',
  DOCTORS_READ: 'doctors:read',
  DOCTORS_MANAGE: 'doctors:manage',
  DEPARTMENTS_READ: 'departments:read',
  DEPARTMENTS_MANAGE: 'departments:manage',
  STAFF_READ: 'staff:read',
  STAFF_MANAGE: 'staff:manage',
  APPOINTMENTS_READ: 'appointments:read',
  APPOINTMENTS_MANAGE: 'appointments:manage',
  SCHEDULES_READ: 'schedules:read',
  SCHEDULES_MANAGE: 'schedules:manage',
  BILLING_READ: 'billing:read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>(Object.values(PERMISSIONS)),
  FRONT_DESK: new Set<Permission>([
    PERMISSIONS.PATIENTS_CREATE,
    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.PATIENTS_UPDATE,
    PERMISSIONS.DOCTORS_READ,
    PERMISSIONS.DEPARTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_MANAGE,
    PERMISSIONS.SCHEDULES_READ,
    PERMISSIONS.BILLING_READ,
  ]),
  CLINICIAN: new Set<Permission>([
    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.PATIENTS_CLINICAL_READ,
    PERMISSIONS.DOCTORS_READ,
    PERMISSIONS.DEPARTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.SCHEDULES_READ,
  ]),
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
