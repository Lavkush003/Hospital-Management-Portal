import { Router } from 'express';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import {
  createVisitPrescriptionController,
  getVisitPrescriptionController,
  listVisitPrescriptionsController,
  updatePrescriptionStatusController,
} from './prescription.controller';
import {
  createPrescriptionBodySchema,
  prescriptionStatusBodySchema,
} from './prescription.validators';

export const prescriptionRoutes = Router({ mergeParams: true });

prescriptionRoutes.get(
  '/',
  requirePermission(PERMISSIONS.CLINICAL_READ),
  listVisitPrescriptionsController,
);

prescriptionRoutes.post(
  '/',
  requirePermission(PERMISSIONS.CLINICAL_MANAGE),
  validateBody(createPrescriptionBodySchema),
  createVisitPrescriptionController,
);

prescriptionRoutes.get(
  '/:prescriptionId',
  requirePermission(PERMISSIONS.CLINICAL_READ),
  getVisitPrescriptionController,
);

prescriptionRoutes.patch(
  '/:prescriptionId/status',
  requirePermission(PERMISSIONS.CLINICAL_MANAGE),
  validateBody(prescriptionStatusBodySchema),
  updatePrescriptionStatusController,
);
