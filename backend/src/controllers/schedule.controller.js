const scheduleService = require('../services/schedule.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/response');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await scheduleService.listSchedules(req.query);
  return sendSuccess(res, items, 200, meta);
});

const create = asyncHandler(async (req, res) => {
  const schedule = await scheduleService.createSchedule(req.body, req);
  return sendCreated(res, schedule);
});

const update = asyncHandler(async (req, res) => {
  const schedule = await scheduleService.updateSchedule(req.params.id, req.body, req);
  return sendSuccess(res, schedule);
});

const remove = asyncHandler(async (req, res) => {
  await scheduleService.deleteSchedule(req.params.id, req);
  return sendSuccess(res, { message: 'Schedule deleted' });
});

module.exports = { list, create, update, remove };
