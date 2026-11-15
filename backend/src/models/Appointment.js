const mongoose = require('mongoose');
const { APPOINTMENT_STATUS, APPOINTMENT_TYPE } = require('../constants/enums');

const appointmentSchema = new mongoose.Schema(
  {
    appointmentNumber: { type: String, required: true, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    appointmentType: { type: String, enum: Object.values(APPOINTMENT_TYPE), default: APPOINTMENT_TYPE.CONSULTATION },
    consultationFee: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: Object.values(APPOINTMENT_STATUS), default: APPOINTMENT_STATUS.BOOKED },
    reason: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true, maxlength: 500 },
    rescheduledAt: { type: Date },
    rescheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

appointmentSchema.index({ doctor: 1, date: 1, startTime: 1 });
appointmentSchema.index({ patient: 1, date: -1 });
appointmentSchema.index({ status: 1, date: 1 });
appointmentSchema.index({ date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
