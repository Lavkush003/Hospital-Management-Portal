import type { RequestHandler } from 'express';
import { getRouteId, requireActor, setNoStore } from '../../utils/http';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import {
  createVisit,
  getVisit,
  listVisits,
  updateVisit,
  updateVisitStatus,
} from './visit.service';
import {
  visitListQuerySchema,
  type CreateVisitBody,
  type UpdateVisitBody,
  type VisitStatusBody,
} from './visit.validators';

export const listVisitsController: RequestHandler = async (request, response) => {
  const query = visitListQuerySchema.parse(request.query);
  const result = await listVisits(
    query,
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const createVisitController: RequestHandler = async (request, response) => {
  const body = request.body as CreateVisitBody;
  const visit = await createVisit(body, requireActor(request), getRequestMetadata(request, response));

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json({ visit });
};

export const getVisitController: RequestHandler = async (request, response) => {
  const result = await getVisit(
    getRouteId(request, 'visitId'),
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const updateVisitController: RequestHandler = async (request, response) => {
  const body = request.body as UpdateVisitBody;
  const visit = await updateVisit(
    getRouteId(request, 'visitId'),
    body,
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ visit });
};

export const updateVisitStatusController: RequestHandler = async (request, response) => {
  const body = request.body as VisitStatusBody;
  const visit = await updateVisitStatus(
    getRouteId(request, 'visitId'),
    body,
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ visit });
};
