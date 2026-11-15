const AuditLog = require('../models/AuditLog');

const SENSITIVE_KEYS = /password|token|authorization|cookie|secret|jwt/i;

function scrub(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1));
  if (typeof value !== 'object') return value;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEYS.test(key)) continue;
    result[key] = scrub(entry, depth + 1);
  }
  return result;
}

async function writeAudit({ req, actor, action, resourceType, resourceId, metadata, outcome = 'SUCCESS' }) {
  try {
    await AuditLog.create({
      actor: actor?._id || actor?.id || null,
      actorRole: actor?.role || null,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : undefined,
      outcome,
      metadata: scrub(metadata),
      ipAddress: req?.ip,
      userAgent: req?.get ? req.get('user-agent') : undefined,
      requestId: req?.id,
    });
  } catch (error) {
    console.error('[audit] failed to write audit log', error.message);
  }
}

function auditFromRequest(req, input) {
  return writeAudit({ req, actor: req.user, ...input });
}

module.exports = { writeAudit, auditFromRequest, scrub };
