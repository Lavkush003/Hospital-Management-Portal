function getPagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const rawLimit = Number.parseInt(query.limit, 10) || 10;
  const limit = Math.min(100, Math.max(1, rawLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function buildMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNextPage: page * limit < total,
    hasPreviousPage: page > 1,
  };
}

function buildSort(sortBy, sortOrder, allowedFields, fallback = { createdAt: -1 }) {
  if (!sortBy || !allowedFields.includes(sortBy)) return fallback;
  return { [sortBy]: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1, _id: 1 };
}

module.exports = { getPagination, buildMeta, buildSort };
