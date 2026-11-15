const reportService = require('../services/report.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

const appointments = asyncHandler(async (req, res) => {
  return sendSuccess(res, await reportService.appointmentReport(req.query));
});
const revenue = asyncHandler(async (req, res) => {
  return sendSuccess(res, await reportService.revenueReport(req.query));
});
const patients = asyncHandler(async (req, res) => {
  return sendSuccess(res, await reportService.patientReport(req.query));
});
const departments = asyncHandler(async (req, res) => {
  return sendSuccess(res, await reportService.departmentReport(req.query));
});

module.exports = { appointments, revenue, patients, departments };
