const mongoose = require('mongoose');
const { STAFF_STATUS, ROLES } = require('../constants/enums');

const staffSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    role: { type: String, enum: [ROLES.ADMIN, ROLES.RECEPTIONIST], default: ROLES.RECEPTIONIST },
    jobTitle: { type: String, required: true, trim: true },
    joiningDate: { type: Date, default: Date.now },
    status: { type: String, enum: Object.values(STAFF_STATUS), default: STAFF_STATUS.ACTIVE },
  },
  { timestamps: true }
);

staffSchema.index({ department: 1, status: 1 });
staffSchema.index({ lastName: 1, firstName: 1 });

module.exports = mongoose.model('Staff', staffSchema);
