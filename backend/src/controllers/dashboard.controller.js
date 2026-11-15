const dashboardService = require('../services/dashboard.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

const admin = asyncHandler(async (req, res) => {
  return sendSuccess(res, await dashboardService.getAdminDashboard());
});
const receptionist = asyncHandler(async (req, res) => {
  return sendSuccess(res, await dashboardService.getReceptionistDashboard());
});
const doctor = asyncHandler(async (req, res) => {
  return sendSuccess(res, await dashboardService.getDoctorDashboard(req));
});

module.exports = { admin, receptionist, doctor };
