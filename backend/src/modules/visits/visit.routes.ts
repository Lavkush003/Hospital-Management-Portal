import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import { noteRoutes } from '../clinical-notes/note.routes';
import { reportRoutes } from '../diagnostic-reports/report.routes';
import { prescriptionRoutes } from '../prescriptions/prescription.routes';
import {
  createVisitController,
  getVisitController,
  listVisitsController,
  updateVisitController,
  updateVisitStatusController,
} from './visit.controller';
import {
  createVisitBodySchema,
  updateVisitBodySchema,
  visitStatusBodySchema,
} from './visit.validators';

export const visitRoutes = Router();

visitRoutes.use(authenticate);

visitRoutes.get('/', requirePermission(PERMISSIONS.CLINICAL_READ), listVisitsController);

visitRoutes.post(
  '/',
  requirePermission(PERMISSIONS.CLINICAL_MANAGE),
  validateBody(createVisitBodySchema),
  createVisitController,
);

visitRoutes.use('/:visitId/notes', noteRoutes);
visitRoutes.use('/:visitId/prescriptions', prescriptionRoutes);
visitRoutes.use('/:visitId/reports', reportRoutes);

visitRoutes.get('/:visitId', requirePermission(PERMISSIONS.CLINICAL_READ), getVisitController);

visitRoutes.patch(
  '/:visitId',
  requirePermission(PERMISSIONS.CLINICAL_MANAGE),
  validateBody(updateVisitBodySchema),
  updateVisitController,
);

visitRoutes.patch(
  '/:visitId/status',
  requirePermission(PERMISSIONS.CLINICAL_MANAGE),
  validateBody(visitStatusBodySchema),
  updateVisitStatusController,
);
