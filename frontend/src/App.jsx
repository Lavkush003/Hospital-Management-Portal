import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import AppLayout from './components/layout/AppLayout';
import { ProtectedRoute, RoleRoute } from './components/RouteGuards';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import AppointmentsPage from './pages/AppointmentsPage';
import BillingPage from './pages/BillingPage';
import EncountersPage from './pages/EncountersPage';
import PrescriptionsPage from './pages/PrescriptionsPage';
import DiagnosticReportsPage from './pages/DiagnosticReportsPage';
import DoctorsPage from './pages/DoctorsPage';
import DepartmentsPage from './pages/DepartmentsPage';
import SchedulesPage from './pages/SchedulesPage';
import StaffPage from './pages/StaffPage';
import ReportsPage from './pages/ReportsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="patients/:id" element={<PatientDetailPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="billing" element={<RoleRoute roles={['ADMIN', 'RECEPTIONIST']}><BillingPage /></RoleRoute>} />
            <Route path="encounters" element={<RoleRoute roles={['ADMIN', 'DOCTOR']}><EncountersPage /></RoleRoute>} />
            <Route path="prescriptions" element={<RoleRoute roles={['ADMIN', 'DOCTOR']}><PrescriptionsPage /></RoleRoute>} />
            <Route path="diagnostic-reports" element={<RoleRoute roles={['ADMIN', 'DOCTOR']}><DiagnosticReportsPage /></RoleRoute>} />
            <Route path="doctors" element={<RoleRoute roles={['ADMIN', 'RECEPTIONIST']}><DoctorsPage /></RoleRoute>} />
            <Route path="departments" element={<RoleRoute roles={['ADMIN', 'RECEPTIONIST']}><DepartmentsPage /></RoleRoute>} />
            <Route path="schedules" element={<RoleRoute roles={['ADMIN']}><SchedulesPage /></RoleRoute>} />
            <Route path="staff" element={<RoleRoute roles={['ADMIN']}><StaffPage /></RoleRoute>} />
            <Route path="reports" element={<RoleRoute roles={['ADMIN']}><ReportsPage /></RoleRoute>} />
            <Route path="audit-logs" element={<RoleRoute roles={['ADMIN']}><AuditLogsPage /></RoleRoute>} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      <Toaster richColors position="top-right" closeButton />
    </>
  );
}
