const clinicalService = require('../services/clinical.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/response');

const listEncounters = asyncHandler(async (req, res) => {
  const { items, meta } = await clinicalService.listEncounters(req.query, req);
  return sendSuccess(res, items, 200, meta);
});
const createEncounter = asyncHandler(async (req, res) => {
  const encounter = await clinicalService.createEncounter(req.body, req);
  return sendCreated(res, encounter);
});
const getEncounter = asyncHandler(async (req, res) => {
  const encounter = await clinicalService.getEncounter(req.params.id, req);
  return sendSuccess(res, encounter);
});
const updateEncounter = asyncHandler(async (req, res) => {
  const encounter = await clinicalService.updateEncounter(req.params.id, req.body, req);
  return sendSuccess(res, encounter);
});

const listPrescriptions = asyncHandler(async (req, res) => {
  const { items, meta } = await clinicalService.listPrescriptions(req.query, req);
  return sendSuccess(res, items, 200, meta);
});
const createPrescription = asyncHandler(async (req, res) => {
  const prescription = await clinicalService.createPrescription(req.body, req);
  return sendCreated(res, prescription);
});
const getPrescription = asyncHandler(async (req, res) => {
  const prescription = await clinicalService.getPrescription(req.params.id, req);
  return sendSuccess(res, prescription);
});
const updatePrescription = asyncHandler(async (req, res) => {
  const prescription = await clinicalService.updatePrescription(req.params.id, req.body, req);
  return sendSuccess(res, prescription);
});

const listReports = asyncHandler(async (req, res) => {
  const { items, meta } = await clinicalService.listDiagnosticReports(req.query, req);
  return sendSuccess(res, items, 200, meta);
});
const createReport = asyncHandler(async (req, res) => {
  const report = await clinicalService.createDiagnosticReport(req.body, req);
  return sendCreated(res, report);
});
const getReport = asyncHandler(async (req, res) => {
  const report = await clinicalService.getDiagnosticReport(req.params.id, req);
  return sendSuccess(res, report);
});
const updateReport = asyncHandler(async (req, res) => {
  const report = await clinicalService.updateDiagnosticReport(req.params.id, req.body, req);
  return sendSuccess(res, report);
});

module.exports = {
  listEncounters,
  createEncounter,
  getEncounter,
  updateEncounter,
  listPrescriptions,
  createPrescription,
  getPrescription,
  updatePrescription,
  listReports,
  createReport,
  getReport,
  updateReport,
};
