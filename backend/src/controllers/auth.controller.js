const env = require('../config/env');
const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { writeAudit } = require('../utils/audit');

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: env.isProduction ? 'none' : 'lax',
    secure: env.isProduction,
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  };
}

const login = asyncHandler(async (req, res) => {
  try {
    const { user, token } = await authService.login(req.body);
    res.cookie(env.cookieName, token, cookieOptions());
    await writeAudit({
      req,
      actor: { _id: user.id, role: user.role },
      action: 'AUTH_LOGIN',
      resourceType: 'User',
      resourceId: user.id,
      metadata: { email: user.email },
    });
    const payload = { user, accessToken: token };
    if (user.role === 'DOCTOR') {
      const Doctor = require('../models/Doctor');
      const doctor = await Doctor.findOne({ email: user.email }).select('doctorId specialization department').lean();
      payload.doctor = doctor || null;
    }
    return sendSuccess(res, payload);
  } catch (error) {
    await writeAudit({
      req,
      action: 'AUTH_LOGIN',
      resourceType: 'User',
      outcome: 'FAILURE',
      metadata: { email: req.body?.email, reason: error.code || 'UNKNOWN' },
    });
    throw error;
  }
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(env.cookieName, { ...cookieOptions(), maxAge: undefined });
  if (req.user) {
    await writeAudit({ req, actor: req.user, action: 'AUTH_LOGOUT', resourceType: 'User', resourceId: req.user._id });
  }
  return sendSuccess(res, { message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  const payload = { user: req.user.toSafeJSON() };
  if (req.doctor) {
    payload.doctor = {
      id: req.doctor._id,
      doctorId: req.doctor.doctorId,
      firstName: req.doctor.firstName,
      lastName: req.doctor.lastName,
      specialization: req.doctor.specialization,
      department: req.doctor.department,
    };
  }
  return sendSuccess(res, payload);
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body.currentPassword, req.body.newPassword);
  await writeAudit({ req, actor: req.user, action: 'PASSWORD_CHANGED', resourceType: 'User', resourceId: req.user._id });
  return sendSuccess(res, { message: 'Password updated' });
});

module.exports = { login, logout, me, changePassword };
