const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await auditService.listAuditLogs(req.query);
  return sendSuccess(res, items, 200, meta);
});

module.exports = { list };
