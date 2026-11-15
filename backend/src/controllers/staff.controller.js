const staffService = require('../services/staff.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/response');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await staffService.listStaff(req.query);
  return sendSuccess(res, items, 200, meta);
});

const create = asyncHandler(async (req, res) => {
  const staff = await staffService.createStaff(req.body, req);
  return sendCreated(res, staff);
});

const getOne = asyncHandler(async (req, res) => {
  const staff = await staffService.getStaff(req.params.id);
  return sendSuccess(res, staff);
});

const update = asyncHandler(async (req, res) => {
  const staff = await staffService.updateStaff(req.params.id, req.body, req);
  return sendSuccess(res, staff);
});

const setStatus = asyncHandler(async (req, res) => {
  const staff = await staffService.setStaffStatus(req.params.id, req.body.status, req);
  return sendSuccess(res, staff);
});

module.exports = { list, create, getOne, update, setStatus };
