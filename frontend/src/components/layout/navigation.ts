import type { UserRole } from '@/types/api';

export type NavIconName =
  | 'dashboard'
  | 'patients'
  | 'doctors'
  | 'departments'
  | 'staff'
  | 'schedules'
  | 'appointments'
  | 'billing'
  | 'reports'
  | 'audit'
  | 'users'
  | 'register'
  | 'availability'
  | 'calendar'
  | 'visits'
  | 'notes'
  | 'prescriptions'
  | 'profile';

export interface NavItem {
  label: string;
  to: string;
  icon: NavIconName;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const adminNavigation: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: '/admin', icon: 'dashboard' }],
  },
  {
    title: 'Care network',
    items: [
      { label: 'Patients', to: '/admin/patients', icon: 'patients' },
      { label: 'Doctors', to: '/admin/doctors', icon: 'doctors' },
      { label: 'Departments', to: '/admin/departments', icon: 'departments' },
      { label: 'Staff', to: '/admin/staff', icon: 'staff' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Schedules', to: '/admin/schedules', icon: 'schedules' },
      { label: 'Appointments', to: '/admin/appointments', icon: 'appointments' },
      { label: 'Billing', to: '/admin/billing', icon: 'billing' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Reports', to: '/admin/reports', icon: 'reports' },
      { label: 'Audit logs', to: '/admin/audit-logs', icon: 'audit' },
      { label: 'User access', to: '/admin/users', icon: 'users' },
    ],
  },
];

const frontDeskNavigation: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: '/front-desk', icon: 'dashboard' }],
  },
  {
    title: 'Patients',
    items: [
      { label: 'Register patient', to: '/front-desk/register', icon: 'register' },
      { label: 'Patient directory', to: '/front-desk/patients', icon: 'patients' },
    ],
  },
  {
    title: 'Appointments',
    items: [
      { label: 'Doctor availability', to: '/front-desk/availability', icon: 'availability' },
      { label: 'Appointments', to: '/front-desk/appointments', icon: 'appointments' },
      { label: 'Calendar', to: '/front-desk/calendar', icon: 'calendar' },
    ],
  },
  {
    title: 'Finance',
    items: [{ label: 'Billing', to: '/front-desk/billing', icon: 'billing' }],
  },
];

const clinicianNavigation: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: '/clinician', icon: 'dashboard' }],
  },
  {
    title: 'Clinical work',
    items: [
      { label: 'Appointments', to: '/clinician/appointments', icon: 'appointments' },
      { label: 'My patients', to: '/clinician/patients', icon: 'patients' },
      { label: 'Visits', to: '/clinician/visits', icon: 'visits' },
    ],
  },
  {
    title: 'Records',
    items: [
      { label: 'Clinical notes', to: '/clinician/notes', icon: 'notes' },
      { label: 'Prescriptions', to: '/clinician/prescriptions', icon: 'prescriptions' },
      { label: 'Diagnostic reports', to: '/clinician/reports', icon: 'reports' },
    ],
  },
];

const patientNavigation: NavSection[] = [
  {
    title: 'My account',
    items: [{ label: 'Profile', to: '/patient', icon: 'profile' }],
  },
];

export function navigationFor(role: UserRole): NavSection[] {
  switch (role) {
    case 'ADMIN':
      return adminNavigation;
    case 'FRONT_DESK':
      return frontDeskNavigation;
    case 'CLINICIAN':
      return clinicianNavigation;
    case 'PATIENT':
      return patientNavigation;
  }
}

export function homePathFor(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'FRONT_DESK':
      return '/front-desk';
    case 'CLINICIAN':
      return '/clinician';
    case 'PATIENT':
      return '/patient';
  }
}

export function flattenNavigation(role: UserRole): NavItem[] {
  return navigationFor(role).flatMap((section) => section.items);
}

