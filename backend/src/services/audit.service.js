const AuditLog = require('../models/AuditLog');
const { getPagination, buildMeta, buildSort } = require('../utils/pagination');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listAuditLogs(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.action) filter.action = new RegExp(escapeRegex(query.action), 'i');
  if (query.resourceType) filter.resourceType = new RegExp(escapeRegex(query.resourceType), 'i');
  if (query.actor) filter.actor = query.actor;
  if (query.outcome) filter.outcome = query.outcome;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
    if (query.dateTo) filter.createdAt.$lte = new Date(`${query.dateTo}T23:59:59.999Z`);
  }
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ action: regex }, { resourceType: regex }, { resourceId: regex }];
  }
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt'], { createdAt: -1 });
  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('actor', 'firstName lastName email role').sort(sort).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
}

module.exports = { listAuditLogs };
