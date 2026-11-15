const doctorService = require('../services/doctor.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/response');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await doctorService.listDoctors(req.query);
  return sendSuccess(res, items, 200, meta);
});

const create = asyncHandler(async (req, res) => {
  const doctor = await doctorService.createDoctor(req.body, req);
  return sendCreated(res, doctor);
});

const getOne = asyncHandler(async (req, res) => {
  const doctor = await doctorService.getDoctor(req.params.id, req);
  return sendSuccess(res, doctor);
});

const update = asyncHandler(async (req, res) => {
  const doctor = await doctorService.updateDoctor(req.params.id, req.body, req);
  return sendSuccess(res, doctor);
});

const setStatus = asyncHandler(async (req, res) => {
  const doctor = await doctorService.setDoctorStatus(req.params.id, req.body.status, req);
  return sendSuccess(res, doctor);
});

const availability = asyncHandler(async (req, res) => {
  const data = await doctorService.getAvailability(req.params.id, req.query.date);
  return sendSuccess(res, data);
});

module.exports = { list, create, getOne, update, setStatus, availability };
