const DoctorSchedule = require('../models/DoctorSchedule');
const Doctor = require('../models/Doctor');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { timeToMinutes } = require('../utils/dates');
const { auditFromRequest } = require('../utils/audit');

async function assertNoOverlap(doctorId, dayOfWeek, startTime, endTime, excludeId) {
  const schedules = await DoctorSchedule.find({
    doctor: doctorId,
    dayOfWeek,
    isActive: true,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  for (const schedule of schedules) {
    const s = timeToMinutes(schedule.startTime);
    const e = timeToMinutes(schedule.endTime);
    if (start < e && end > s) {
      throw ApiError.conflict('This schedule overlaps an existing block', 'SCHEDULE_OVERLAP');
    }
  }
}

async function createSchedule(data, req) {
  const doctor = await Doctor.findById(data.doctor);
  if (!doctor) throw ApiError.badRequest('Doctor does not exist', 'INVALID_DOCTOR');
  await assertNoOverlap(data.doctor, data.dayOfWeek, data.startTime, data.endTime);
  const schedule = await DoctorSchedule.create(data);
  await auditFromRequest(req, {
    action: 'SCHEDULE_CREATED',
    resourceType: 'DoctorSchedule',
    resourceId: schedule._id,
    metadata: { doctor: data.doctor, dayOfWeek: data.dayOfWeek },
  });
  return schedule;
}

async function listSchedules(query) {
  const { page, limit, skip } = getPagination({ ...query, limit: query.limit || 100 });
  const filter = {};
  if (query.doctor) filter.doctor = query.doctor;
  if (query.dayOfWeek !== undefined) filter.dayOfWeek = query.dayOfWeek;
  const [items, total] = await Promise.all([
    DoctorSchedule.find(filter)
      .populate({ path: 'doctor', select: 'firstName lastName doctorId specialization', populate: { path: 'department', select: 'name' } })
      .sort({ dayOfWeek: 1, startTime: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DoctorSchedule.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
}

async function updateSchedule(id, data, req) {
  const schedule = await DoctorSchedule.findById(id);
  if (!schedule) throw ApiError.notFound('Schedule not found', 'SCHEDULE_NOT_FOUND');
  const dayOfWeek = data.dayOfWeek !== undefined ? data.dayOfWeek : schedule.dayOfWeek;
  const startTime = data.startTime || schedule.startTime;
  const endTime = data.endTime || schedule.endTime;
  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    throw ApiError.badRequest('Start time must be before end time', 'INVALID_TIME_RANGE');
  }
  await assertNoOverlap(schedule.doctor, dayOfWeek, startTime, endTime, schedule._id);
  Object.assign(schedule, data);
  await schedule.save();
  await auditFromRequest(req, {
    action: 'SCHEDULE_UPDATED',
    resourceType: 'DoctorSchedule',
    resourceId: schedule._id,
    metadata: { fields: Object.keys(data) },
  });
  return schedule;
}

async function deleteSchedule(id, req) {
  const schedule = await DoctorSchedule.findByIdAndDelete(id);
  if (!schedule) throw ApiError.notFound('Schedule not found', 'SCHEDULE_NOT_FOUND');
  await auditFromRequest(req, {
    action: 'SCHEDULE_DELETED',
    resourceType: 'DoctorSchedule',
    resourceId: id,
  });
  return true;
}

module.exports = { createSchedule, listSchedules, updateSchedule, deleteSchedule };
