import type { RequestHandler } from 'express';
import { getRequestMetadata } from '../../utils/request-metadata';
import { getRouteId, requireActor, setNoStore } from '../../utils/http';
import { HTTP_STATUS } from '../../utils/http-status';
import { createPatient, getPatient, listPatients, updatePatient } from './patient.service';
import {
  patientListQuerySchema,
  type PatientCreateInput,
  type PatientUpdateInput,
} from './patient.validators';

export const listPatientsController: RequestHandler = async (request, response) => {
  const query = patientListQuerySchema.parse(request.query);
  const result = await listPatients(query, requireActor(request));

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const createPatientController: RequestHandler = async (request, response) => {
  const patient = await createPatient(
    request.body as PatientCreateInput,
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json({ patient });
};

export const getPatientController: RequestHandler = async (request, response) => {
  const patient = await getPatient(getRouteId(request, 'patientId'), requireActor(request));

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ patient });
};

export const updatePatientController: RequestHandler = async (request, response) => {
  const patient = await updatePatient(
    getRouteId(request, 'patientId'),
    request.body as PatientUpdateInput,
    requireActor(request),
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ patient });
};
