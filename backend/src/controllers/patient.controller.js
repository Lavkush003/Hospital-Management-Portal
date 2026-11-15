const patientService = require('../services/patient.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/response');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await patientService.listPatients(req.query, req);
  return sendSuccess(res, items, 200, meta);
});

const create = asyncHandler(async (req, res) => {
  const patient = await patientService.createPatient(req.body, req);
  return sendCreated(res, patient);
});

const getOne = asyncHandler(async (req, res) => {
  const patient = await patientService.getPatient(req.params.id, req);
  return sendSuccess(res, patient);
});

const update = asyncHandler(async (req, res) => {
  const patient = await patientService.updatePatient(req.params.id, req.body, req);
  return sendSuccess(res, patient);
});

const setStatus = asyncHandler(async (req, res) => {
  const patient = await patientService.setPatientStatus(req.params.id, req.body.status, req);
  return sendSuccess(res, patient);
});

const history = asyncHandler(async (req, res) => {
  const data = await patientService.getPatientHistory(req.params.id, req);
  return sendSuccess(res, data);
});

module.exports = { list, create, getOne, update, setStatus, history };
