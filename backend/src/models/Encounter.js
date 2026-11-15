const mongoose = require('mongoose');
const { ENCOUNTER_STATUS, VISIT_TYPE } = require('../constants/enums');

const encounterSchema = new mongoose.Schema(
  {
    encounterId: { type: String, required: true, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    encounterDate: { type: Date, default: Date.now },
    visitType: { type: String, enum: Object.values(VISIT_TYPE), default: VISIT_TYPE.CONSULTATION },
    chiefComplaint: { type: String, required: true, trim: true, maxlength: 1000 },
    clinicalNotes: { type: String, trim: true, maxlength: 10000 },
    vitalSigns: {
      temperatureC: { type: Number },
      bloodPressure: { type: String },
      heartRate: { type: Number },
      weightKg: { type: Number },
      heightCm: { type: Number },
      oxygenSaturation: { type: Number },
    },
    treatmentNotes: { type: String, trim: true, maxlength: 10000 },
    followUpDate: { type: Date },
    status: { type: String, enum: Object.values(ENCOUNTER_STATUS), default: ENCOUNTER_STATUS.OPEN },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

encounterSchema.index({ patient: 1, encounterDate: -1 });
encounterSchema.index({ doctor: 1, encounterDate: -1 });
encounterSchema.index({ appointment: 1 }, { unique: true, sparse: true });
encounterSchema.index({ status: 1 });

module.exports = mongoose.model('Encounter', encounterSchema);
