import { Router } from 'express';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import {
  createVisitReportController,
  getVisitReportController,
  listVisitReportsController,
  updateVisitReportController,
} from './report.controller';
import { createReportBodySchema, updateReportBodySchema } from './report.validators';

export const reportRoutes = Router({ mergeParams: true });

reportRoutes.get('/', requirePermission(PERMISSIONS.CLINICAL_READ), listVisitReportsController);

reportRoutes.post(
  '/',
  requirePermission(PERMISSIONS.CLINICAL_MANAGE),
  validateBody(createReportBodySchema),
  createVisitReportController,
);

reportRoutes.get(
  '/:reportId',
  requirePermission(PERMISSIONS.CLINICAL_READ),
  getVisitReportController,
);

reportRoutes.patch(
  '/:reportId',
  requirePermission(PERMISSIONS.CLINICAL_MANAGE),
  validateBody(updateReportBodySchema),
  updateVisitReportController,
);
