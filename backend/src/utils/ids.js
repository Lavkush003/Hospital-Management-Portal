const Counter = require('../models/Counter');

async function nextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return counter.seq;
}

async function nextId(name, prefix, width = 5) {
  const seq = await nextSequence(name);
  return `${prefix}-${String(seq).padStart(width, '0')}`;
}

module.exports = { nextSequence, nextId };
