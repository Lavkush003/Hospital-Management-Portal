import type { RequestHandler } from 'express';
import { getRouteId, requireActor, setNoStore } from '../../utils/http';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import {
  createVisitNote,
  getVisitNote,
  listVisitNotes,
  updateVisitNote,
} from './note.service';
import type { CreateNoteBody, UpdateNoteBody } from './note.validators';

export const listVisitNotesController: RequestHandler = async (request, response) => {
  const notes = await listVisitNotes(
    getRouteId(request, 'visitId'),
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ notes });
};

export const createVisitNoteController: RequestHandler = async (request, response) => {
  const body = request.body as CreateNoteBody;
  const result = await createVisitNote(
    getRouteId(request, 'visitId'),
    body,
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json(result);
};

export const getVisitNoteController: RequestHandler = async (request, response) => {
  const result = await getVisitNote(
    getRouteId(request, 'visitId'),
    getRouteId(request, 'noteId'),
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const updateVisitNoteController: RequestHandler = async (request, response) => {
  const body = request.body as UpdateNoteBody;
  const result = await updateVisitNote(
    getRouteId(request, 'visitId'),
    getRouteId(request, 'noteId'),
    body,
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};
