function sanitizeValue(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== 'object') return value;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    result[key] = sanitizeValue(entry, depth + 1);
  }
  return result;
}

module.exports = function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeValue(req.body);
  if (req.query && typeof req.query === 'object') req.query = sanitizeValue(req.query);
  if (req.params && typeof req.params === 'object') req.params = sanitizeValue(req.params);
  next();
};
