import type { RequestHandler } from 'express';
import { getRouteId, requireActor, setNoStore } from '../../utils/http';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import {
  changeStaffRole,
  changeStaffStatus,
  createStaff,
  getStaff,
  listStaff,
  updateStaff,
} from './staff.service';
import {
  staffListQuerySchema,
  type StaffCreateInput,
  type StaffRoleUpdateInput,
  type StaffStatusUpdateInput,
  type StaffUpdateInput,
} from './staff.validators';

export const listStaffController: RequestHandler = async (request, response) => {
  const query = staffListQuerySchema.parse(request.query);
  const result = await listStaff(query);

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const createStaffController: RequestHandler = async (request, response) => {
  const staff = await createStaff(
    request.body as StaffCreateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json({ staff });
};

export const getStaffController: RequestHandler = async (request, response) => {
  const staff = await getStaff(getRouteId(request, 'staffId'));

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ staff });
};

export const updateStaffController: RequestHandler = async (request, response) => {
  const staff = await updateStaff(
    getRouteId(request, 'staffId'),
    request.body as StaffUpdateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ staff });
};

export const changeStaffStatusController: RequestHandler = async (request, response) => {
  const staff = await changeStaffStatus(
    getRouteId(request, 'staffId'),
    request.body as StaffStatusUpdateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ staff });
};

export const changeStaffRoleController: RequestHandler = async (request, response) => {
  const staff = await changeStaffRole(
    getRouteId(request, 'staffId'),
    request.body as StaffRoleUpdateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ staff });
};
