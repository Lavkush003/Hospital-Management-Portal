import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import { doctorScheduleRoutes } from '../schedules/schedule.routes';
import {
  changeDoctorStatusController,
  createDoctorController,
  getDoctorController,
  listDoctorsController,
  updateDoctorController,
} from './doctor.controller';
import {
  doctorCreateSchema,
  doctorStatusSchemaUpdate,
  doctorUpdateSchema,
} from './doctor.validators';

export const doctorRoutes = Router();

doctorRoutes.use(authenticate);

doctorRoutes.get('/', requirePermission(PERMISSIONS.DOCTORS_READ), listDoctorsController);

doctorRoutes.post(
  '/',
  requirePermission(PERMISSIONS.DOCTORS_MANAGE),
  validateBody(doctorCreateSchema),
  createDoctorController,
);

doctorRoutes.use('/:doctorId', doctorScheduleRoutes);

doctorRoutes.get('/:doctorId', requirePermission(PERMISSIONS.DOCTORS_READ), getDoctorController);

doctorRoutes.patch(
  '/:doctorId',
  requirePermission(PERMISSIONS.DOCTORS_MANAGE),
  validateBody(doctorUpdateSchema),
  updateDoctorController,
);

doctorRoutes.patch(
  '/:doctorId/status',
  requirePermission(PERMISSIONS.DOCTORS_MANAGE),
  validateBody(doctorStatusSchemaUpdate),
  changeDoctorStatusController,
);
