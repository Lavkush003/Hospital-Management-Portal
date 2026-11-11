import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import {
  availableDoctorsController,
  availableSlotsController,
  bookAppointmentController,
  cancelAppointmentController,
  getAppointmentController,
  listAppointmentsController,
  rescheduleAppointmentController,
  updateAppointmentStatusController,
} from './appointment.controller';
import {
  appointmentStatusBodySchema,
  bookAppointmentBodySchema,
  cancelAppointmentBodySchema,
  rescheduleAppointmentBodySchema,
} from './appointment.validators';

export const appointmentRoutes = Router();

appointmentRoutes.use(authenticate);

appointmentRoutes.get(
  '/available-doctors',
  requirePermission(PERMISSIONS.APPOINTMENTS_READ),
  availableDoctorsController,
);

appointmentRoutes.get(
  '/available-slots',
  requirePermission(PERMISSIONS.APPOINTMENTS_READ),
  availableSlotsController,
);

appointmentRoutes.get(
  '/',
  requirePermission(PERMISSIONS.APPOINTMENTS_READ),
  listAppointmentsController,
);

appointmentRoutes.post(
  '/',
  requirePermission(PERMISSIONS.APPOINTMENTS_MANAGE),
  validateBody(bookAppointmentBodySchema),
  bookAppointmentController,
);

appointmentRoutes.get(
  '/:appointmentId',
  requirePermission(PERMISSIONS.APPOINTMENTS_READ),
  getAppointmentController,
);

appointmentRoutes.post(
  '/:appointmentId/reschedule',
  requirePermission(PERMISSIONS.APPOINTMENTS_MANAGE),
  validateBody(rescheduleAppointmentBodySchema),
  rescheduleAppointmentController,
);

appointmentRoutes.post(
  '/:appointmentId/cancel',
  requirePermission(PERMISSIONS.APPOINTMENTS_MANAGE),
  validateBody(cancelAppointmentBodySchema),
  cancelAppointmentController,
);

appointmentRoutes.patch(
  '/:appointmentId/status',
  requirePermission(PERMISSIONS.APPOINTMENTS_MANAGE),
  validateBody(appointmentStatusBodySchema),
  updateAppointmentStatusController,
);
