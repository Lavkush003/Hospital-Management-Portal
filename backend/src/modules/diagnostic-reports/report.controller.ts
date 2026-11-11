import type { RequestHandler } from 'express';
import { getRouteId, requireActor, setNoStore } from '../../utils/http';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import {
  createVisitReport,
  getVisitReport,
  listVisitReports,
  updateVisitReport,
} from './report.service';
import type { CreateReportBody, UpdateReportBody } from './report.validators';

export const listVisitReportsController: RequestHandler = async (request, response) => {
  const reports = await listVisitReports(
    getRouteId(request, 'visitId'),
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ reports });
};

export const createVisitReportController: RequestHandler = async (request, response) => {
  const body = request.body as CreateReportBody;
  const result = await createVisitReport(
    getRouteId(request, 'visitId'),
    body,
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json(result);
};

export const getVisitReportController: RequestHandler = async (request, response) => {
  const result = await getVisitReport(
    getRouteId(request, 'visitId'),
    getRouteId(request, 'reportId'),
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const updateVisitReportController: RequestHandler = async (request, response) => {
  const body = request.body as UpdateReportBody;
  const result = await updateVisitReport(
    getRouteId(request, 'visitId'),
    getRouteId(request, 'reportId'),
    body,
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};
