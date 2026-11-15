const mongoose = require('mongoose');
const { DOCTOR_STATUS } = require('../constants/enums');

const doctorSchema = new mongoose.Schema(
  {
    doctorId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    specialization: { type: String, required: true, trim: true },
    qualification: { type: String, required: true, trim: true },
    experienceYears: { type: Number, min: 0, max: 70, default: 0 },
    consultationFee: { type: Number, min: 0, default: 0 },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
    },
    appointmentDuration: { type: Number, min: 10, max: 120, default: 30 },
    status: { type: String, enum: Object.values(DOCTOR_STATUS), default: DOCTOR_STATUS.ACTIVE },
    bio: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

doctorSchema.index({ department: 1, status: 1 });
doctorSchema.index({ lastName: 1, firstName: 1 });
doctorSchema.index({ specialization: 1 });

module.exports = mongoose.model('Doctor', doctorSchema);
