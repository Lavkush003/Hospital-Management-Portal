import type { RequestHandler } from 'express';
import { getRouteId, requireActor, setNoStore } from '../../utils/http';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import {
  createVisitPrescription,
  getVisitPrescription,
  listVisitPrescriptions,
  updatePrescriptionStatus,
} from './prescription.service';
import type { CreatePrescriptionBody, PrescriptionStatusBody } from './prescription.validators';

export const listVisitPrescriptionsController: RequestHandler = async (request, response) => {
  const prescriptions = await listVisitPrescriptions(
    getRouteId(request, 'visitId'),
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ prescriptions });
};

export const createVisitPrescriptionController: RequestHandler = async (request, response) => {
  const body = request.body as CreatePrescriptionBody;
  const result = await createVisitPrescription(
    getRouteId(request, 'visitId'),
    body,
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json(result);
};

export const getVisitPrescriptionController: RequestHandler = async (request, response) => {
  const result = await getVisitPrescription(
    getRouteId(request, 'visitId'),
    getRouteId(request, 'prescriptionId'),
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const updatePrescriptionStatusController: RequestHandler = async (request, response) => {
  const body = request.body as PrescriptionStatusBody;
  const result = await updatePrescriptionStatus(
    getRouteId(request, 'visitId'),
    getRouteId(request, 'prescriptionId'),
    body,
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};
