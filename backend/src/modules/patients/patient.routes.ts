import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import {
  createPatientController,
  getPatientController,
  listPatientsController,
  updatePatientController,
} from './patient.controller';
import { patientCreateSchema, patientUpdateSchema } from './patient.validators';

export const patientRoutes = Router();

patientRoutes.use(authenticate);

patientRoutes.get('/', requirePermission(PERMISSIONS.PATIENTS_READ), listPatientsController);

patientRoutes.post(
  '/',
  requirePermission(PERMISSIONS.PATIENTS_CREATE),
  validateBody(patientCreateSchema),
  createPatientController,
);

patientRoutes.get(
  '/:patientId',
  requirePermission(PERMISSIONS.PATIENTS_READ),
  getPatientController,
);

patientRoutes.patch(
  '/:patientId',
  requirePermission(PERMISSIONS.PATIENTS_UPDATE),
  validateBody(patientUpdateSchema),
  updatePatientController,
);
