import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import type { UserRole } from '@/types/api';
import { useAuth } from '@/features/auth/auth-context';
import { homePathFor } from '@/components/layout/navigation';
import { RootLayout } from '@/layouts/RootLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

const DashboardPage = lazy(async () => {
  const module = await import('@/features/dashboard/DashboardPage');
  return { default: module.DashboardPage };
});

const PatientsPage = lazy(async () => {
  const module = await import('@/features/patients/PatientsPage');
  return { default: module.PatientsPage };
});

const RegisterPatientPage = lazy(async () => {
  const module = await import('@/features/patients/RegisterPatientPage');
  return { default: module.RegisterPatientPage };
});

const DoctorsPage = lazy(async () => {
  const module = await import('@/features/doctors/DoctorsPage');
  return { default: module.DoctorsPage };
});

const DepartmentsPage = lazy(async () => {
  const module = await import('@/features/departments/DepartmentsPage');
  return { default: module.DepartmentsPage };
});

const StaffPage = lazy(async () => {
  const module = await import('@/features/staff/StaffPage');
  return { default: module.StaffPage };
});

const SchedulesPage = lazy(async () => {
  const module = await import('@/features/schedules/SchedulesPage');
  return { default: module.SchedulesPage };
});

const AppointmentsPage = lazy(async () => {
  const module = await import('@/features/appointments/AppointmentsPage');
  return { default: module.AppointmentsPage };
});

const AvailabilityPage = lazy(async () => {
  const module = await import('@/features/appointments/AvailabilityPage');
  return { default: module.AvailabilityPage };
});

const CalendarPage = lazy(async () => {
  const module = await import('@/features/appointments/CalendarPage');
  return { default: module.CalendarPage };
});

const BillingPage = lazy(async () => {
  const module = await import('@/features/billing/BillingPage');
  return { default: module.BillingPage };
});

const ReportsPage = lazy(async () => {
  const module = await import('@/features/admin/ReportsPage');
  return { default: module.ReportsPage };
});

const AuditLogsPage = lazy(async () => {
  const module = await import('@/features/admin/AuditLogsPage');
  return { default: module.AuditLogsPage };
});

const UserAccessPage = lazy(async () => {
  const module = await import('@/features/admin/UserAccessPage');
  return { default: module.UserAccessPage };
});

const VisitsPage = lazy(async () => {
  const module = await import('@/features/clinical/VisitsPage');
  return { default: module.VisitsPage };
});

const VisitDetailPage = lazy(async () => {
  const module = await import('@/features/clinical/VisitDetailPage');
  return { default: module.VisitDetailPage };
});

const ClinicalRecordsPage = lazy(async () => {
  const module = await import('@/features/clinical/ClinicalRecordsPage');
  return { default: module.ClinicalRecordsPage };
});

const PatientClinicalPage = lazy(async () => {
  const module = await import('@/features/clinical/PatientClinicalPage');
  return { default: module.PatientClinicalPage };
});

const PatientProfilePage = lazy(async () => {
  const module = await import('@/features/patient/PatientProfilePage');
  return { default: module.PatientProfilePage };
});

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500">
        <p role="status">Restoring your secure session…</p>
      </div>
    );
  }
  if (!user) return <Navigate replace state={{ from: location }} to="/login" />;
  return <RootLayout />;
}

function RoleRoute({ roles }: { roles: UserRole[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate replace to="/login" />;
  if (!roles.includes(user.role)) return <Navigate replace to={homePathFor(user.role)} />;
  return <Outlet />;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate replace to="/login" />;
  return <Navigate replace to={homePathFor(user.role)} />;
}

const admin: UserRole[] = ['ADMIN'];
const frontDesk: UserRole[] = ['FRONT_DESK'];
const clinician: UserRole[] = ['CLINICIAN'];
const patient: UserRole[] = ['PATIENT'];

const adminPatients = (
  <PatientsPage
    eyebrow="Care network"
    title="Patients"
    description="Register patients and maintain accurate demographic and contact records."
  />
);

const frontDeskPatients = (
  <PatientsPage
    eyebrow="Patient directory"
    title="Patients"
    description="Search the patient directory and keep registration details up to date."
  />
);

const clinicianPatients = (
  <PatientsPage
    eyebrow="Clinical work"
    title="My patients"
    description="Patients under your care with access to their clinical record."
  />
);

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorPage /> },
  { path: '/register', element: <RegisterPage />, errorElement: <RouteErrorPage /> },
  {
    path: '/',
    element: <ProtectedLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomeRedirect /> },
      {
        element: <RoleRoute roles={admin} />,
        children: [
          {
            path: 'admin',
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'patients', element: adminPatients },
              { path: 'doctors', element: <DoctorsPage /> },
              { path: 'departments', element: <DepartmentsPage /> },
              { path: 'staff', element: <StaffPage /> },
              { path: 'schedules', element: <SchedulesPage /> },
              { path: 'appointments', element: <AppointmentsPage /> },
              { path: 'billing', element: <BillingPage /> },
              { path: 'reports', element: <ReportsPage /> },
              { path: 'audit-logs', element: <AuditLogsPage /> },
              { path: 'users', element: <UserAccessPage /> },
            ],
          },
        ],
      },
      {
        element: <RoleRoute roles={frontDesk} />,
        children: [
          {
            path: 'front-desk',
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'register', element: <RegisterPatientPage /> },
              { path: 'patients', element: frontDeskPatients },
              { path: 'availability', element: <AvailabilityPage /> },
              { path: 'appointments', element: <AppointmentsPage /> },
              { path: 'calendar', element: <CalendarPage /> },
              { path: 'billing', element: <BillingPage /> },
            ],
          },
        ],
      },
      {
        element: <RoleRoute roles={clinician} />,
        children: [
          {
            path: 'clinician',
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'appointments', element: <AppointmentsPage /> },
              { path: 'patients', element: clinicianPatients },
              { path: 'patients/:patientId', element: <PatientClinicalPage /> },
              { path: 'visits', element: <VisitsPage /> },
              { path: 'visits/:visitId', element: <VisitDetailPage /> },
              { path: 'notes', element: <ClinicalRecordsPage mode="notes" /> },
              { path: 'prescriptions', element: <ClinicalRecordsPage mode="prescriptions" /> },
              { path: 'reports', element: <ClinicalRecordsPage mode="reports" /> },
            ],
          },
        ],
      },
      {
        element: <RoleRoute roles={patient} />,
        children: [
          {
            path: 'patient',
            children: [{ index: true, element: <PatientProfilePage /> }],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function AppRouter() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-slate-500" role="status">
          Loading workspace…
        </div>
      }
    >
      <RouterProvider router={router} />
    </Suspense>
  );
}
