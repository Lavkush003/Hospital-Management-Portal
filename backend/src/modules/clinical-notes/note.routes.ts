import { Router } from 'express';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import {
  createVisitNoteController,
  getVisitNoteController,
  listVisitNotesController,
  updateVisitNoteController,
} from './note.controller';
import { createNoteBodySchema, updateNoteBodySchema } from './note.validators';

export const noteRoutes = Router({ mergeParams: true });

noteRoutes.get('/', requirePermission(PERMISSIONS.CLINICAL_READ), listVisitNotesController);

noteRoutes.post(
  '/',
  requirePermission(PERMISSIONS.CLINICAL_MANAGE),
  validateBody(createNoteBodySchema),
  createVisitNoteController,
);

noteRoutes.get(
  '/:noteId',
  requirePermission(PERMISSIONS.CLINICAL_READ),
  getVisitNoteController,
);

noteRoutes.patch(
  '/:noteId',
  requirePermission(PERMISSIONS.CLINICAL_MANAGE),
  validateBody(updateNoteBodySchema),
  updateVisitNoteController,
);
