const departmentService = require('../services/department.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/response');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await departmentService.listDepartments(req.query);
  return sendSuccess(res, items, 200, meta);
});

const create = asyncHandler(async (req, res) => {
  const department = await departmentService.createDepartment(req.body, req);
  return sendCreated(res, department);
});

const getOne = asyncHandler(async (req, res) => {
  const department = await departmentService.getDepartment(req.params.id);
  return sendSuccess(res, department);
});

const update = asyncHandler(async (req, res) => {
  const department = await departmentService.updateDepartment(req.params.id, req.body, req);
  return sendSuccess(res, department);
});

const remove = asyncHandler(async (req, res) => {
  await departmentService.deleteDepartment(req.params.id, req);
  return sendSuccess(res, { message: 'Department deleted' });
});

module.exports = { list, create, getOne, update, remove };
