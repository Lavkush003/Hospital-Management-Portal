import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import {
  createPatientController,
  getClinicalSummaryController,
  getDoctorScheduleController,
  getInvoiceController,
  getPatientController,
  listAppointmentsController,
  listUsersController,
} from './access.controller';
import { createPatientSchema } from './access.validators';

export const accessRoutes = Router();

accessRoutes.use(authenticate);

accessRoutes.get('/admin/users', requirePermission(PERMISSIONS.USERS_MANAGE), listUsersController);

accessRoutes.post(
  '/patients',
  requirePermission(PERMISSIONS.PATIENTS_CREATE),
  validateBody(createPatientSchema),
  createPatientController,
);

accessRoutes.get(
  '/patients/:patientId/clinical-summary',
  requirePermission(PERMISSIONS.PATIENTS_CLINICAL_READ),
  getClinicalSummaryController,
);

accessRoutes.get(
  '/patients/:patientId',
  requirePermission(PERMISSIONS.PATIENTS_READ),
  getPatientController,
);

accessRoutes.get(
  '/appointments',
  requirePermission(PERMISSIONS.APPOINTMENTS_READ),
  listAppointmentsController,
);

accessRoutes.get(
  '/doctors/:doctorId/schedule',
  requirePermission(PERMISSIONS.SCHEDULES_READ),
  getDoctorScheduleController,
);

accessRoutes.get(
  '/billing/invoices/:invoiceId',
  requirePermission(PERMISSIONS.BILLING_READ),
  getInvoiceController,
);
