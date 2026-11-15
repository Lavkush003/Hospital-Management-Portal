const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Department = require('../models/Department');
const DoctorSchedule = require('../models/DoctorSchedule');
const Appointment = require('../models/Appointment');
const AppointmentSlotReservation = require('../models/AppointmentSlotReservation');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { nextId } = require('../utils/ids');
const { getPagination, buildMeta, buildSort } = require('../utils/pagination');
const { auditFromRequest } = require('../utils/audit');
const { dayOfWeek, parseDateKey, toDateKey, addMinutes, isPastSlot, minutesToTime, timeToMinutes } = require('../utils/dates');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function createDefaultSchedules(doctor) {
  const days = doctor.workingDays?.length ? doctor.workingDays : [1, 2, 3, 4, 5];
  const start = doctor.workingHours?.start || '09:00';
  const end = doctor.workingHours?.end || '17:00';
  await DoctorSchedule.deleteMany({ doctor: doctor._id });
  await DoctorSchedule.insertMany(
    days.map((dayOfWeekValue) => ({
      doctor: doctor._id,
      dayOfWeek: dayOfWeekValue,
      startTime: start,
      endTime: end,
      slotDuration: doctor.appointmentDuration,
    }))
  );
}

async function createDoctor(data, req) {
  const department = await Department.findById(data.department);
  if (!department) throw ApiError.badRequest('Department does not exist', 'INVALID_DEPARTMENT');
  if (department.status !== 'ACTIVE') throw ApiError.badRequest('Department is not active', 'DEPARTMENT_INACTIVE');

  const existingUser = await User.findOne({ email: data.email.toLowerCase() });
  if (existingUser) throw ApiError.conflict('An account with this email already exists', 'EMAIL_IN_USE');

  const passwordHash = await User.hashPassword(data.password || env.seedPassword);
  const user = await User.create({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    role: 'DOCTOR',
    passwordHash,
  });

  try {
    const doctorId = await nextId('doctor', 'DOC');
    const doctor = await Doctor.create({
      doctorId,
      userId: user._id,
      department: data.department,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      specialization: data.specialization,
      qualification: data.qualification,
      experienceYears: data.experienceYears || 0,
      consultationFee: data.consultationFee || 0,
      workingDays: data.workingDays || [1, 2, 3, 4, 5],
      workingHours: data.workingHours || { start: '09:00', end: '17:00' },
      appointmentDuration: data.appointmentDuration || 30,
      bio: data.bio,
    });
    await createDefaultSchedules(doctor);
    await auditFromRequest(req, {
      action: 'DOCTOR_CREATED',
      resourceType: 'Doctor',
      resourceId: doctor.doctorId,
      metadata: { doctorId: doctor.doctorId, department: data.department },
    });
    return doctor;
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
}

async function listDoctors(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.department) filter.department = query.department;
  if (query.status) filter.status = query.status;
  if (query.specialization) filter.specialization = new RegExp(escapeRegex(query.specialization), 'i');
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ firstName: regex }, { lastName: regex }, { doctorId: regex }, { email: regex }, { specialization: regex }];
  }
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt', 'firstName', 'lastName', 'consultationFee', 'experienceYears'], { firstName: 1 });
  const [items, total] = await Promise.all([
    Doctor.find(filter).populate('department', 'name code').sort(sort).skip(skip).limit(limit).lean(),
    Doctor.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
}

async function getDoctor(id, _req) {
  const doctor = await Doctor.findById(id).populate('department', 'name code').lean();
  if (!doctor) throw ApiError.notFound('Doctor not found', 'DOCTOR_NOT_FOUND');
  const [schedules, upcomingAppointments, completedCount] = await Promise.all([
    DoctorSchedule.find({ doctor: id, isActive: true }).sort({ dayOfWeek: 1, startTime: 1 }).lean(),
    Appointment.find({
      doctor: id,
      date: { $gte: toDateKey() },
      status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
    })
      .populate('patient', 'firstName lastName patientId')
      .sort({ date: 1, startTime: 1 })
      .limit(10)
      .lean(),
    Appointment.countDocuments({ doctor: id, status: 'COMPLETED' }),
  ]);
  return { ...doctor, schedules, upcomingAppointments, completedAppointments: completedCount };
}

async function updateDoctor(id, data, req) {
  const doctor = await Doctor.findById(id);
  if (!doctor) throw ApiError.notFound('Doctor not found', 'DOCTOR_NOT_FOUND');

  if (data.department) {
    const department = await Department.findById(data.department);
    if (!department) throw ApiError.badRequest('Department does not exist', 'INVALID_DEPARTMENT');
  }
  if (data.email && data.email.toLowerCase() !== doctor.email) {
    const existing = await User.findOne({ email: data.email.toLowerCase(), _id: { $ne: doctor.userId } });
    if (existing) throw ApiError.conflict('An account with this email already exists', 'EMAIL_IN_USE');
  }

  const allowed = ['firstName', 'lastName', 'email', 'phone', 'department', 'specialization', 'qualification', 'experienceYears', 'consultationFee', 'workingDays', 'workingHours', 'appointmentDuration', 'bio'];
  const updates = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }
  Object.assign(doctor, updates);
  await doctor.save();

  const userUpdates = {};
  if (updates.firstName) userUpdates.firstName = updates.firstName;
  if (updates.lastName) userUpdates.lastName = updates.lastName;
  if (updates.email) userUpdates.email = updates.email;
  if (updates.phone !== undefined) userUpdates.phone = updates.phone;
  if (Object.keys(userUpdates).length) {
    await User.updateOne({ _id: doctor.userId }, { $set: userUpdates }, { runValidators: true });
  }

  await auditFromRequest(req, {
    action: 'DOCTOR_UPDATED',
    resourceType: 'Doctor',
    resourceId: doctor.doctorId,
    metadata: { fields: Object.keys(updates) },
  });
  return getDoctor(id, req);
}

async function setDoctorStatus(id, status, req) {
  const doctor = await Doctor.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  if (!doctor) throw ApiError.notFound('Doctor not found', 'DOCTOR_NOT_FOUND');
  const userStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  await User.updateOne({ _id: doctor.userId }, { $set: { status: userStatus } });
  await auditFromRequest(req, {
    action: 'DOCTOR_STATUS_CHANGED',
    resourceType: 'Doctor',
    resourceId: doctor.doctorId,
    metadata: { status },
  });
  return doctor;
}

async function getAvailability(doctorId, dateKey) {
  const doctor = await Doctor.findById(doctorId).populate('department', 'name code').lean();
  if (!doctor) throw ApiError.notFound('Doctor not found', 'DOCTOR_NOT_FOUND');
  if (!parseDateKey(dateKey)) throw ApiError.badRequest('Invalid date', 'INVALID_DATE');

  if (doctor.status !== 'ACTIVE') {
    return { doctor: { id: doctor._id, name: `Dr. ${doctor.firstName} ${doctor.lastName}`, status: doctor.status }, date: dateKey, slots: [], message: 'Doctor is not accepting appointments' };
  }

  const weekday = dayOfWeek(dateKey);
  const schedules = await DoctorSchedule.find({ doctor: doctorId, dayOfWeek: weekday, isActive: true }).sort({ startTime: 1 }).lean();
  if (!schedules.length) {
    return { doctor: { id: doctor._id, name: `Dr. ${doctor.firstName} ${doctor.lastName}`, status: doctor.status }, date: dateKey, slots: [], message: 'Doctor does not work on this day' };
  }

  const [reservations, appointments] = await Promise.all([
    AppointmentSlotReservation.find({ doctor: doctorId, date: dateKey }).select('startTime').lean(),
    Appointment.find({ doctor: doctorId, date: dateKey, status: { $ne: 'CANCELLED' } }).select('startTime').lean(),
  ]);
  const blocked = new Set([...reservations.map((r) => r.startTime), ...appointments.map((a) => a.startTime)]);

  const slots = [];
  for (const schedule of schedules) {
    const duration = schedule.slotDuration || doctor.appointmentDuration || 30;
    const startMinutes = timeToMinutes(schedule.startTime);
    const endMinutes = timeToMinutes(schedule.endTime);
    for (let cursor = startMinutes; cursor + duration <= endMinutes; cursor += duration) {
      const startTime = minutesToTime(cursor);
      const endTime = addMinutes(startTime, duration);
      const available = !blocked.has(startTime) && !isPastSlot(dateKey, startTime);
      slots.push({ startTime, endTime, available, scheduleId: schedule._id, room: schedule.room });
    }
  }
  slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { doctor: { id: doctor._id, name: `Dr. ${doctor.firstName} ${doctor.lastName}`, status: doctor.status, consultationFee: doctor.consultationFee }, date: dateKey, slots };
}

module.exports = {
  createDoctor,
  listDoctors,
  getDoctor,
  updateDoctor,
  setDoctorStatus,
  getAvailability,
  createDefaultSchedules,
};
