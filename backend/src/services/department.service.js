const Department = require('../models/Department');
const Doctor = require('../models/Doctor');
const Staff = require('../models/Staff');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta, buildSort } = require('../utils/pagination');
const { auditFromRequest } = require('../utils/audit');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function createDepartment(data, req) {
  const department = await Department.create(data);
  await auditFromRequest(req, {
    action: 'DEPARTMENT_CREATED',
    resourceType: 'Department',
    resourceId: department._id,
    metadata: { name: department.name },
  });
  return department;
}

async function listDepartments(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: regex }, { code: regex }, { description: regex }];
  }
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt', 'name', 'code'], { name: 1 });
  const [items, total] = await Promise.all([
    Department.find(filter).populate('head', 'firstName lastName specialization').sort(sort).skip(skip).limit(limit).lean(),
    Department.countDocuments(filter),
  ]);
  const doctorCounts = await Doctor.aggregate([
    { $match: { department: { $in: items.map((item) => item._id) } } },
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(doctorCounts.map((row) => [String(row._id), row.count]));
  return {
    items: items.map((item) => ({ ...item, doctorCount: countMap.get(String(item._id)) || 0 })),
    meta: buildMeta({ page, limit, total }),
  };
}

async function getDepartment(id) {
  const department = await Department.findById(id)
    .populate('head', 'firstName lastName specialization')
    .populate('doctors', '')
    .lean();
  if (!department) throw ApiError.notFound('Department not found', 'DEPARTMENT_NOT_FOUND');
  const doctors = await Doctor.find({ department: id }).select('firstName lastName specialization status consultationFee').lean();
  const staff = await Staff.find({ department: id }).select('firstName lastName jobTitle status').lean();
  return { ...department, doctors, staff };
}

async function updateDepartment(id, data, req) {
  if (data.head) {
    const doctor = await Doctor.findById(data.head);
    if (!doctor) throw ApiError.badRequest('Department head must be an existing doctor', 'INVALID_HEAD');
  }
  const department = await Department.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  if (!department) throw ApiError.notFound('Department not found', 'DEPARTMENT_NOT_FOUND');
  await auditFromRequest(req, {
    action: 'DEPARTMENT_UPDATED',
    resourceType: 'Department',
    resourceId: department._id,
    metadata: { fields: Object.keys(data) },
  });
  return department;
}

async function deleteDepartment(id, req) {
  const department = await Department.findById(id);
  if (!department) throw ApiError.notFound('Department not found', 'DEPARTMENT_NOT_FOUND');
  const [doctorCount, staffCount, appointmentCount] = await Promise.all([
    Doctor.countDocuments({ department: id }),
    Staff.countDocuments({ department: id }),
    Appointment.countDocuments({ department: id }),
  ]);
  if (doctorCount || staffCount) {
    throw ApiError.conflict(
      'Department has assigned doctors or staff. Reassign them or deactivate the department instead.',
      'DEPARTMENT_HAS_DEPENDENCIES',
      { doctorCount, staffCount }
    );
  }
  if (appointmentCount) {
    throw ApiError.conflict(
      'Department has appointment history and cannot be deleted. Deactivate it instead.',
      'DEPARTMENT_HAS_HISTORY',
      { appointmentCount }
    );
  }
  await department.deleteOne();
  await auditFromRequest(req, {
    action: 'DEPARTMENT_DELETED',
    resourceType: 'Department',
    resourceId: id,
    metadata: { name: department.name },
  });
  return true;
}

module.exports = { createDepartment, listDepartments, getDepartment, updateDepartment, deleteDepartment };
