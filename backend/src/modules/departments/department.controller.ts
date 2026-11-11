import type { RequestHandler } from 'express';
import { getRouteId, requireActor, setNoStore } from '../../utils/http';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import {
  assignDoctorsToDepartment,
  createDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
} from './department.service';
import {
  departmentListQuerySchema,
  type AssignDoctorsInput,
  type DepartmentCreateInput,
  type DepartmentUpdateInput,
} from './department.validators';

export const listDepartmentsController: RequestHandler = async (request, response) => {
  const query = departmentListQuerySchema.parse(request.query);
  const result = await listDepartments(query);

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const createDepartmentController: RequestHandler = async (request, response) => {
  const department = await createDepartment(
    request.body as DepartmentCreateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json({ department });
};

export const getDepartmentController: RequestHandler = async (request, response) => {
  const department = await getDepartment(getRouteId(request, 'departmentId'));

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ department });
};

export const updateDepartmentController: RequestHandler = async (request, response) => {
  const department = await updateDepartment(
    getRouteId(request, 'departmentId'),
    request.body as DepartmentUpdateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ department });
};

export const assignDoctorsController: RequestHandler = async (request, response) => {
  const department = await assignDoctorsToDepartment(
    getRouteId(request, 'departmentId'),
    request.body as AssignDoctorsInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ department });
};
