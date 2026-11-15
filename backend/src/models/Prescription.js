const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    frequency: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    instructions: { type: String, trim: true },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionId: { type: String, required: true, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter', required: true },
    prescriptionDate: { type: Date, default: Date.now },
    medicines: {
      type: [medicineSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'At least one medicine is required',
      },
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

prescriptionSchema.index({ patient: 1, prescriptionDate: -1 });
prescriptionSchema.index({ doctor: 1, prescriptionDate: -1 });
prescriptionSchema.index({ encounter: 1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
