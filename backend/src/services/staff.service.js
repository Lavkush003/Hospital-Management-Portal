const Staff = require('../models/Staff');
const User = require('../models/User');
const Department = require('../models/Department');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { nextId } = require('../utils/ids');
const { getPagination, buildMeta, buildSort } = require('../utils/pagination');
const { auditFromRequest } = require('../utils/audit');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function createStaff(data, req) {
  if (data.department) {
    const department = await Department.findById(data.department);
    if (!department) throw ApiError.badRequest('Department does not exist', 'INVALID_DEPARTMENT');
  }
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists', 'EMAIL_IN_USE');

  const passwordHash = await User.hashPassword(data.password || env.seedPassword);
  const user = await User.create({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    role: data.role,
    passwordHash,
  });

  try {
    const employeeId = await nextId('staff', 'EMP');
    const staff = await Staff.create({
      employeeId,
      userId: user._id,
      department: data.department || undefined,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      role: data.role,
      jobTitle: data.jobTitle,
      joiningDate: data.joiningDate || new Date(),
    });
    await auditFromRequest(req, {
      action: 'STAFF_CREATED',
      resourceType: 'Staff',
      resourceId: staff.employeeId,
      metadata: { role: staff.role },
    });
    return staff;
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
}

async function listStaff(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.department) filter.department = query.department;
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ firstName: regex }, { lastName: regex }, { employeeId: regex }, { email: regex }, { jobTitle: regex }];
  }
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt', 'firstName', 'lastName'], { createdAt: -1 });
  const [items, total] = await Promise.all([
    Staff.find(filter).populate('department', 'name code').sort(sort).skip(skip).limit(limit).lean(),
    Staff.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
}

async function getStaff(id) {
  const staff = await Staff.findById(id).populate('department', 'name code').lean();
  if (!staff) throw ApiError.notFound('Staff member not found', 'STAFF_NOT_FOUND');
  return staff;
}

async function updateStaff(id, data, req) {
  const staff = await Staff.findById(id);
  if (!staff) throw ApiError.notFound('Staff member not found', 'STAFF_NOT_FOUND');
  if (String(staff.userId) === String(req.user._id) && data.role && data.role !== staff.role) {
    throw ApiError.forbidden('You cannot change your own role', 'SELF_ROLE_CHANGE_FORBIDDEN');
  }
  if (data.department) {
    const department = await Department.findById(data.department);
    if (!department) throw ApiError.badRequest('Department does not exist', 'INVALID_DEPARTMENT');
  }
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'role', 'department', 'jobTitle', 'joiningDate', 'status'];
  const updates = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }
  Object.assign(staff, updates);
  await staff.save();

  const userUpdates = {};
  if (updates.firstName) userUpdates.firstName = updates.firstName;
  if (updates.lastName) userUpdates.lastName = updates.lastName;
  if (updates.email) userUpdates.email = updates.email;
  if (updates.phone !== undefined) userUpdates.phone = updates.phone;
  if (updates.role) userUpdates.role = updates.role;
  if (updates.status) userUpdates.status = updates.status === 'ACTIVE' || updates.status === 'ON_LEAVE' ? 'ACTIVE' : 'INACTIVE';
  if (Object.keys(userUpdates).length) {
    await User.updateOne({ _id: staff.userId }, { $set: userUpdates }, { runValidators: true });
  }

  await auditFromRequest(req, {
    action: updates.role ? 'STAFF_ROLE_CHANGED' : 'STAFF_UPDATED',
    resourceType: 'Staff',
    resourceId: staff.employeeId,
    metadata: { fields: Object.keys(updates) },
  });
  return staff;
}

async function setStaffStatus(id, status, req) {
  const staff = await Staff.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  if (!staff) throw ApiError.notFound('Staff member not found', 'STAFF_NOT_FOUND');
  await User.updateOne(
    { _id: staff.userId },
    { $set: { status: status === 'ACTIVE' || status === 'ON_LEAVE' ? 'ACTIVE' : 'INACTIVE' } }
  );
  await auditFromRequest(req, {
    action: 'STAFF_STATUS_CHANGED',
    resourceType: 'Staff',
    resourceId: staff.employeeId,
    metadata: { status },
  });
  return staff;
}

module.exports = { createStaff, listStaff, getStaff, updateStaff, setStaffStatus };
