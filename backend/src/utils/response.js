function sendSuccess(res, data, statusCode = 200, meta) {
  const payload = { success: true, data };
  if (meta !== undefined) payload.meta = meta;
  return res.status(statusCode).json(payload);
}

function sendCreated(res, data, meta) {
  return sendSuccess(res, data, 201, meta);
}

module.exports = { sendSuccess, sendCreated };
