import type { RequestHandler } from 'express';
import { getRouteId, requireActor, setNoStore } from '../../utils/http';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import {
  changeDoctorStatus,
  createDoctor,
  getDoctor,
  listDoctors,
  updateDoctor,
} from './doctor.service';
import {
  doctorListQuerySchema,
  type DoctorCreateInput,
  type DoctorStatusUpdateInput,
  type DoctorUpdateInput,
} from './doctor.validators';

export const listDoctorsController: RequestHandler = async (request, response) => {
  const query = doctorListQuerySchema.parse(request.query);
  const result = await listDoctors(query);

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const createDoctorController: RequestHandler = async (request, response) => {
  const doctor = await createDoctor(
    request.body as DoctorCreateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json({ doctor });
};

export const getDoctorController: RequestHandler = async (request, response) => {
  const doctor = await getDoctor(getRouteId(request, 'doctorId'), requireActor(request));

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ doctor });
};

export const updateDoctorController: RequestHandler = async (request, response) => {
  const doctor = await updateDoctor(
    getRouteId(request, 'doctorId'),
    request.body as DoctorUpdateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ doctor });
};

export const changeDoctorStatusController: RequestHandler = async (request, response) => {
  const doctor = await changeDoctorStatus(
    getRouteId(request, 'doctorId'),
    request.body as DoctorStatusUpdateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ doctor });
};
