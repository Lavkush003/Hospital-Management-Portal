const mongoose = require('mongoose');

const slotReservationSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  },
  { timestamps: true }
);

slotReservationSchema.index({ doctor: 1, date: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('AppointmentSlotReservation', slotReservationSchema);
