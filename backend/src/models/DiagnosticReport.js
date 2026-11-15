const mongoose = require('mongoose');
const { REPORT_STATUS } = require('../constants/enums');

const diagnosticReportSchema = new mongoose.Schema(
  {
    reportId: { type: String, required: true, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter' },
    testName: { type: String, required: true, trim: true },
    testCategory: { type: String, required: true, trim: true },
    reportDate: { type: Date, default: Date.now },
    status: { type: String, enum: Object.values(REPORT_STATUS), default: REPORT_STATUS.ORDERED },
    notes: { type: String, trim: true, maxlength: 5000 },
    fileReference: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

diagnosticReportSchema.index({ patient: 1, reportDate: -1 });
diagnosticReportSchema.index({ doctor: 1, reportDate: -1 });
diagnosticReportSchema.index({ status: 1 });
diagnosticReportSchema.index({ testCategory: 1 });

module.exports = mongoose.model('DiagnosticReport', diagnosticReportSchema);
