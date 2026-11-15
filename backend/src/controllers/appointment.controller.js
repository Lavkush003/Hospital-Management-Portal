const appointmentService = require('../services/appointment.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/response');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await appointmentService.listAppointments(req.query, req);
  return sendSuccess(res, items, 200, meta);
});

const create = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.createAppointment(req.body, req);
  return sendCreated(res, appointment);
});

const getOne = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.getAppointment(req.params.id, req);
  return sendSuccess(res, appointment);
});

const update = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.updateAppointment(req.params.id, req.body, req);
  return sendSuccess(res, appointment);
});

const reschedule = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.rescheduleAppointment(req.params.id, req.body, req);
  return sendSuccess(res, appointment);
});

const cancel = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.cancelAppointment(req.params.id, req.body.reason, req);
  return sendSuccess(res, appointment);
});

const updateStatus = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.updateStatus(req.params.id, req.body.status, req);
  return sendSuccess(res, appointment);
});

module.exports = { list, create, getOne, update, reschedule, cancel, updateStatus };
