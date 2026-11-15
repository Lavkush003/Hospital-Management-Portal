const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 1000 },
    location: { type: String, trim: true },
    phone: { type: String, trim: true },
    head: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

departmentSchema.index({ status: 1 });

module.exports = mongoose.model('Department', departmentSchema);
