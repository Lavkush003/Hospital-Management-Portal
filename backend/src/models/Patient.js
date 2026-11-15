const mongoose = require('mongoose');
const { GENDERS, BLOOD_GROUPS, PATIENT_STATUS } = require('../constants/enums');

const patientSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, unique: true },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: GENDERS, required: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: {
      line1: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relationship: { type: String, trim: true },
    },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, default: 'UNKNOWN' },
    registrationDate: { type: Date, default: Date.now },
    status: { type: String, enum: Object.values(PATIENT_STATUS), default: PATIENT_STATUS.ACTIVE },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

patientSchema.index({ lastName: 1, firstName: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ status: 1 });
patientSchema.index({ registrationDate: -1 });

module.exports = mongoose.model('Patient', patientSchema);
