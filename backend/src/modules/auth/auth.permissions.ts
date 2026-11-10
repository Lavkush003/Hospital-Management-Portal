import type { UserRole } from '@prisma/client';

export const PERMISSIONS = {
  USERS_MANAGE: 'users:manage',
  PATIENTS_CREATE: 'patients:create',
  PATIENTS_READ: 'patients:read',
  PATIENTS_CLINICAL_READ: 'patients:clinical:read',
  APPOINTMENTS_READ: 'appointments:read',
  SCHEDULES_READ: 'schedules:read',
  BILLING_READ: 'billing:read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>(Object.values(PERMISSIONS)),
  FRONT_DESK: new Set<Permission>([
    PERMISSIONS.PATIENTS_CREATE,
    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.SCHEDULES_READ,
    PERMISSIONS.BILLING_READ,
  ]),
  CLINICIAN: new Set<Permission>([
    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.PATIENTS_CLINICAL_READ,
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.SCHEDULES_READ,
  ]),
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
