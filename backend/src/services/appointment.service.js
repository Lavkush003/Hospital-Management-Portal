const Appointment = require('../models/Appointment');
const AppointmentSlotReservation = require('../models/AppointmentSlotReservation');
const Doctor = require('../models/Doctor');
const DoctorSchedule = require('../models/DoctorSchedule');
const Patient = require('../models/Patient');
const ApiError = require('../utils/ApiError');
const { nextId } = require('../utils/ids');
const { getPagination, buildMeta, buildSort } = require('../utils/pagination');
const { auditFromRequest } = require('../utils/audit');
const { parseDateKey, toDateKey, addMinutes, isPastSlot, timeToMinutes } = require('../utils/dates');
const { APPOINTMENT_TRANSITIONS } = require('../constants/enums');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function validateSlot({ doctorId, date, startTime, ignoreAppointmentId }) {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw ApiError.badRequest('Doctor does not exist', 'INVALID_DOCTOR');
  if (doctor.status !== 'ACTIVE') throw ApiError.badRequest('Doctor is not accepting appointments', 'DOCTOR_INACTIVE');

  const parsed = parseDateKey(date);
  if (!parsed) throw ApiError.badRequest('Invalid appointment date', 'INVALID_DATE');
  if (date < toDateKey()) throw ApiError.badRequest('Appointments cannot be booked in the past', 'APPOINTMENT_IN_PAST');

  const weekday = parsed.getDay();
  const schedule = await DoctorSchedule.findOne({
    doctor: doctorId,
    dayOfWeek: weekday,
    isActive: true,
    startTime: { $lte: startTime },
    endTime: { $gt: startTime },
  }).sort({ startTime: 1 });

  if (!schedule) throw ApiError.badRequest('The doctor is not available at this time', 'OUTSIDE_WORKING_HOURS');

  const duration = schedule.slotDuration || doctor.appointmentDuration || 30;
  const endTime = addMinutes(startTime, duration);
  if (timeToMinutes(endTime) > timeToMinutes(schedule.endTime)) {
    throw ApiError.badRequest('Appointment does not fit within the working schedule', 'OUTSIDE_WORKING_HOURS');
  }
  const offset = timeToMinutes(startTime) - timeToMinutes(schedule.startTime);
  if (offset < 0 || offset % duration !== 0) {
    throw ApiError.badRequest('Selected time is not an available slot', 'SLOT_MISALIGNED');
  }
  if (isPastSlot(date, startTime)) {
    throw ApiError.badRequest('Appointments cannot be booked in the past', 'APPOINTMENT_IN_PAST');
  }

  const overlapFilter = {
    doctor: doctorId,
    date,
    status: { $ne: 'CANCELLED' },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (ignoreAppointmentId) overlapFilter._id = { $ne: ignoreAppointmentId };
  const conflict = await Appointment.exists(overlapFilter);
  if (conflict) throw ApiError.conflict('This time slot is already booked', 'SLOT_TAKEN');

  return { doctor, endTime, duration, schedule, date };
}

async function reserveSlot({ doctor, date, startTime, endTime }) {
  try {
    return await AppointmentSlotReservation.create({ doctor, date, startTime, endTime });
  } catch (error) {
    if (error?.code === 11000) {
      throw ApiError.conflict('This time slot is already booked', 'SLOT_TAKEN');
    }
    throw error;
  }
}

async function populateAppointment(id) {
  return Appointment.findById(id)
    .populate('patient', 'firstName lastName patientId phone email gender dateOfBirth')
    .populate({ path: 'doctor', select: 'firstName lastName doctorId specialization consultationFee', populate: { path: 'department', select: 'name code' } })
    .populate('department', 'name code')
    .lean();
}

async function createAppointment(data, req) {
  const patient = await Patient.findById(data.patient);
  if (!patient) throw ApiError.badRequest('Patient does not exist', 'INVALID_PATIENT');
  if (patient.status !== 'ACTIVE') throw ApiError.badRequest('Patient account is inactive', 'PATIENT_INACTIVE');

  const { doctor, endTime } = await validateSlot({
    doctorId: data.doctor,
    date: data.date,
    startTime: data.startTime,
  });

  const reservation = await reserveSlot({ doctor: doctor._id, date: data.date, startTime: data.startTime, endTime });

  try {
    const appointmentNumber = await nextId('appointment', 'APT');
    const appointment = await Appointment.create({
      appointmentNumber,
      patient: patient._id,
      doctor: doctor._id,
      department: doctor.department,
      date: data.date,
      startTime: data.startTime,
      endTime,
      appointmentType: data.appointmentType || 'CONSULTATION',
      consultationFee: doctor.consultationFee,
      reason: data.reason,
      notes: data.notes,
      createdBy: req.user._id,
      status: 'BOOKED',
    });
    reservation.appointment = appointment._id;
    await reservation.save();
    await auditFromRequest(req, {
      action: 'APPOINTMENT_BOOKED',
      resourceType: 'Appointment',
      resourceId: appointment.appointmentNumber,
      metadata: { patient: patient.patientId, doctor: doctor.doctorId, date: data.date, startTime: data.startTime },
    });
    return populateAppointment(appointment._id);
  } catch (error) {
    await AppointmentSlotReservation.deleteOne({ _id: reservation._id });
    throw error;
  }
}

async function assertAppointmentAccess(appointment, req) {
  if (req.user.role === 'DOCTOR' && String(appointment.doctor?._id || appointment.doctor) !== String(req.doctor._id)) {
    throw ApiError.forbidden('This appointment is not assigned to you', 'APPOINTMENT_NOT_ASSIGNED');
  }
}

function searchFilter(search) {
  return new RegExp(escapeRegex(search), 'i');
}

async function listAppointments(query, req) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (req.user.role === 'DOCTOR') filter.doctor = req.doctor._id;
  else if (query.doctor) filter.doctor = query.doctor;
  if (query.patient) filter.patient = query.patient;
  if (query.department) filter.department = query.department;
  if (query.status) filter.status = query.status;
  if (query.date) filter.date = query.date;
  if (query.dateFrom || query.dateTo) {
    filter.date = {};
    if (query.dateFrom) filter.date.$gte = query.dateFrom;
    if (query.dateTo) filter.date.$lte = query.dateTo;
  }
  if (query.upcomingOnly === 'true') {
    filter.date = { ...(filter.date || {}), $gte: toDateKey() };
    filter.status = filter.status || { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] };
  }
  if (query.search) {
    const regex = searchFilter(query.search);
    const [patients, doctors] = await Promise.all([
      Patient.find({ $or: [{ firstName: regex }, { lastName: regex }, { patientId: regex }, { phone: regex }] }).select('_id').limit(200).lean(),
      Doctor.find({ $or: [{ firstName: regex }, { lastName: regex }, { doctorId: regex }] }).select('_id').limit(200).lean(),
    ]);
    filter.$or = [
      { appointmentNumber: regex },
      { patient: { $in: patients.map((p) => p._id) } },
      { doctor: { $in: doctors.map((d) => d._id) } },
    ];
  }
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt', 'date', 'startTime'], { date: 1, startTime: 1 });
  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .populate('patient', 'firstName lastName patientId phone')
      .populate({ path: 'doctor', select: 'firstName lastName doctorId specialization', populate: { path: 'department', select: 'name code' } })
      .populate('department', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Appointment.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
}

async function getAppointment(id, req) {
  const appointment = await populateAppointment(id);
  if (!appointment) throw ApiError.notFound('Appointment not found', 'APPOINTMENT_NOT_FOUND');
  await assertAppointmentAccess(appointment, req);
  return appointment;
}

async function rescheduleAppointment(id, data, req) {
  const appointment = await Appointment.findById(id);
  if (!appointment) throw ApiError.notFound('Appointment not found', 'APPOINTMENT_NOT_FOUND');
  await assertAppointmentAccess(appointment, req);
  if (!['BOOKED', 'CONFIRMED', 'CHECKED_IN'].includes(appointment.status)) {
    throw ApiError.conflict(`Appointments in status ${appointment.status} cannot be rescheduled`, 'INVALID_STATUS_TRANSITION');
  }
  const { endTime } = await validateSlot({
    doctorId: appointment.doctor,
    date: data.date,
    startTime: data.startTime,
    ignoreAppointmentId: appointment._id,
  });

  const newReservation = await reserveSlot({
    doctor: appointment.doctor,
    date: data.date,
    startTime: data.startTime,
    endTime,
  });

  const oldReservation = await AppointmentSlotReservation.findOne({ appointment: appointment._id });
  try {
    appointment.date = data.date;
    appointment.startTime = data.startTime;
    appointment.endTime = endTime;
    appointment.rescheduledAt = new Date();
    appointment.rescheduledBy = req.user._id;
    if (data.reason) appointment.reason = data.reason;
    await appointment.save();
    newReservation.appointment = appointment._id;
    await newReservation.save();
    if (oldReservation && String(oldReservation._id) !== String(newReservation._id)) {
      await AppointmentSlotReservation.deleteOne({ _id: oldReservation._id });
    }
    await auditFromRequest(req, {
      action: 'APPOINTMENT_RESCHEDULED',
      resourceType: 'Appointment',
      resourceId: appointment.appointmentNumber,
      metadata: { date: data.date, startTime: data.startTime },
    });
    return populateAppointment(appointment._id);
  } catch (error) {
    await AppointmentSlotReservation.deleteOne({ _id: newReservation._id });
    throw error;
  }
}

async function cancelAppointment(id, reason, req) {
  const appointment = await Appointment.findById(id);
  if (!appointment) throw ApiError.notFound('Appointment not found', 'APPOINTMENT_NOT_FOUND');
  await assertAppointmentAccess(appointment, req);
  if (appointment.status === 'CANCELLED') return populateAppointment(id);
  if (appointment.status === 'COMPLETED') {
    throw ApiError.conflict('Completed appointments cannot be cancelled', 'INVALID_STATUS_TRANSITION');
  }
  appointment.status = 'CANCELLED';
  appointment.cancelledAt = new Date();
  appointment.cancelledBy = req.user._id;
  appointment.cancellationReason = reason;
  await appointment.save();
  await AppointmentSlotReservation.deleteMany({ appointment: appointment._id });
  await auditFromRequest(req, {
    action: 'APPOINTMENT_CANCELLED',
    resourceType: 'Appointment',
    resourceId: appointment.appointmentNumber,
    metadata: { reason },
  });
  return populateAppointment(id);
}

async function updateAppointment(id, data, req) {
  const appointment = await Appointment.findById(id);
  if (!appointment) throw ApiError.notFound('Appointment not found', 'APPOINTMENT_NOT_FOUND');
  await assertAppointmentAccess(appointment, req);
  const allowed = ['appointmentType', 'reason', 'notes'];
  for (const key of allowed) {
    if (data[key] !== undefined) appointment[key] = data[key];
  }
  await appointment.save();
  await auditFromRequest(req, {
    action: 'APPOINTMENT_UPDATED',
    resourceType: 'Appointment',
    resourceId: appointment.appointmentNumber,
    metadata: { fields: Object.keys(data) },
  });
  return populateAppointment(id);
}

async function updateStatus(id, status, req) {
  const appointment = await Appointment.findById(id);
  if (!appointment) throw ApiError.notFound('Appointment not found', 'APPOINTMENT_NOT_FOUND');
  await assertAppointmentAccess(appointment, req);
  const allowedNext = APPOINTMENT_TRANSITIONS[appointment.status] || [];
  if (!allowedNext.includes(status)) {
    throw ApiError.conflict(
      `Cannot transition appointment from ${appointment.status} to ${status}`,
      'INVALID_STATUS_TRANSITION',
      { allowedNext }
    );
  }
  if (req.user.role === 'RECEPTIONIST' && ['IN_PROGRESS', 'COMPLETED'].includes(status)) {
    throw ApiError.forbidden('Only clinicians can move an appointment into consultation or completion', 'ROLE_FORBIDDEN');
  }
  const previousStatus = appointment.status;
  appointment.status = status;
  if (status === 'CANCELLED') {
    appointment.cancelledAt = new Date();
    appointment.cancelledBy = req.user._id;
    await AppointmentSlotReservation.deleteMany({ appointment: appointment._id });
  }
  await appointment.save();
  await auditFromRequest(req, {
    action: 'APPOINTMENT_STATUS_UPDATED',
    resourceType: 'Appointment',
    resourceId: appointment.appointmentNumber,
    metadata: { from: previousStatus, to: status },
  });
  return populateAppointment(id);
}

module.exports = {
  validateSlot,
  createAppointment,
  listAppointments,
  getAppointment,
  rescheduleAppointment,
  cancelAppointment,
  updateAppointment,
  updateStatus,
  assertAppointmentAccess,
  populateAppointment,
};
