const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Encounter = require('../models/Encounter');
const Prescription = require('../models/Prescription');
const DiagnosticReport = require('../models/DiagnosticReport');
const Invoice = require('../models/Invoice');
const ApiError = require('../utils/ApiError');
const { nextId } = require('../utils/ids');
const { getPagination, buildMeta, buildSort } = require('../utils/pagination');
const { assertDoctorPatientAccess, doctorCanAccessPatient } = require('../utils/access');
const { auditFromRequest } = require('../utils/audit');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function createPatient(data, req) {
  const patientId = await nextId('patient', 'PAT');
  const patient = await Patient.create({
    ...data,
    patientId,
    email: data.email || undefined,
    registrationDate: new Date(),
    createdBy: req.user?._id,
  });
  await auditFromRequest(req, {
    action: 'PATIENT_CREATED',
    resourceType: 'Patient',
    resourceId: patient.patientId,
    metadata: { patientId: patient.patientId },
  });
  return patient;
}

async function buildAccessFilter(req) {
  if (req.user.role !== 'DOCTOR') return {};
  const [appointmentPatients, encounterPatients] = await Promise.all([
    Appointment.distinct('patient', { doctor: req.doctor._id }),
    Encounter.distinct('patient', { doctor: req.doctor._id }),
  ]);
  const ids = [...new Set([...appointmentPatients, ...encounterPatients].map(String))];
  return { _id: { $in: ids } };
}

async function listPatients(query, req) {
  const { page, limit, skip } = getPagination(query);
  const filter = { ...(await buildAccessFilter(req)) };
  if (query.status) filter.status = query.status;
  if (query.gender) filter.gender = query.gender;
  if (query.bloodGroup) filter.bloodGroup = query.bloodGroup;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [
      { firstName: regex },
      { lastName: regex },
      { patientId: regex },
      { phone: regex },
      { email: regex },
    ];
  }
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt', 'firstName', 'lastName', 'registrationDate', 'patientId'], { createdAt: -1 });
  const [items, total] = await Promise.all([
    Patient.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Patient.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
}

async function getPatient(id, req, { audit = true } = {}) {
  const patient = await Patient.findById(id).lean();
  if (!patient) throw ApiError.notFound('Patient not found', 'PATIENT_NOT_FOUND');
  if (req.user.role === 'DOCTOR') {
    const allowed = await doctorCanAccessPatient(req.doctor._id, patient._id);
    if (!allowed) throw ApiError.forbidden('This patient is not assigned to you', 'PATIENT_NOT_ASSIGNED');
  }
  if (audit) {
    await auditFromRequest(req, {
      action: 'PATIENT_VIEWED',
      resourceType: 'Patient',
      resourceId: patient.patientId,
      metadata: { patientId: patient.patientId },
    });
  }
  return patient;
}

async function updatePatient(id, data, req) {
  const patient = await Patient.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  if (!patient) throw ApiError.notFound('Patient not found', 'PATIENT_NOT_FOUND');
  await auditFromRequest(req, {
    action: 'PATIENT_UPDATED',
    resourceType: 'Patient',
    resourceId: patient.patientId,
    metadata: { patientId: patient.patientId, fields: Object.keys(data) },
  });
  return patient;
}

async function setPatientStatus(id, status, req) {
  const patient = await Patient.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  if (!patient) throw ApiError.notFound('Patient not found', 'PATIENT_NOT_FOUND');
  await auditFromRequest(req, {
    action: 'PATIENT_STATUS_CHANGED',
    resourceType: 'Patient',
    resourceId: patient.patientId,
    metadata: { status },
  });
  return patient;
}

async function getPatientHistory(id, req) {
  const patient = await getPatient(id, req, { audit: false });
  const patientFilter = { patient: patient._id };
  if (req.user.role === 'DOCTOR') {
    await assertDoctorPatientAccess(req, patient._id);
  }
  const clinicalAllowed = ['ADMIN', 'DOCTOR'].includes(req.user.role);
  const [appointments, encounters, prescriptions, reports, invoices] = await Promise.all([
    Appointment.find(patientFilter)
      .populate('doctor', 'firstName lastName specialization')
      .populate('department', 'name code')
      .sort({ date: -1, startTime: -1 })
      .limit(100)
      .lean(),
    clinicalAllowed
      ? Encounter.find(patientFilter).populate('doctor', 'firstName lastName').sort({ encounterDate: -1 }).limit(100).lean()
      : [],
    clinicalAllowed
      ? Prescription.find(patientFilter).populate('doctor', 'firstName lastName').sort({ prescriptionDate: -1 }).limit(100).lean()
      : [],
    clinicalAllowed
      ? DiagnosticReport.find(patientFilter).populate('doctor', 'firstName lastName').sort({ reportDate: -1 }).limit(100).lean()
      : [],
    Invoice.find(patientFilter).sort({ invoiceDate: -1 }).limit(100).lean(),
  ]);
  return { patient, appointments, encounters, prescriptions, reports, invoices };
}

module.exports = {
  createPatient,
  listPatients,
  getPatient,
  updatePatient,
  setPatientStatus,
  getPatientHistory,
};
