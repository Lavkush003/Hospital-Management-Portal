const mongoose = require('mongoose');

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotDuration: { type: Number, min: 10, max: 120, default: 30 },
    room: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

doctorScheduleSchema.index({ doctor: 1, dayOfWeek: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('DoctorSchedule', doctorScheduleSchema);
