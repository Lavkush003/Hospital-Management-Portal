const Encounter = require('../models/Encounter');
const Prescription = require('../models/Prescription');
const DiagnosticReport = require('../models/DiagnosticReport');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const { nextId } = require('../utils/ids');
const { getPagination, buildMeta, buildSort } = require('../utils/pagination');
const { auditFromRequest } = require('../utils/audit');
const { doctorCanAccessPatient } = require('../utils/access');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dateRangeFilter(field, query) {
  if (!query.dateFrom && !query.dateTo) return {};
  const filter = {};
  if (query.dateFrom) filter.$gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
  if (query.dateTo) filter.$lte = new Date(`${query.dateTo}T23:59:59.999Z`);
  return { [field]: filter };
}

function assertClinicalAllowed(req) {
  if (!['ADMIN', 'DOCTOR'].includes(req.user.role)) {
    throw ApiError.forbidden('Clinical records are restricted to clinicians and administrators', 'CLINICAL_FORBIDDEN');
  }
}

function doctorScope(req) {
  return req.user.role === 'DOCTOR' ? { doctor: req.doctor._id } : {};
}

/* ---------------------------- Encounters ---------------------------- */

async function createEncounter(data, req) {
  if (req.user.role !== 'DOCTOR') {
    throw ApiError.forbidden('Only clinicians can create encounter records', 'ROLE_FORBIDDEN');
  }
  const patient = await Patient.findById(data.patient);
  if (!patient) throw ApiError.badRequest('Patient does not exist', 'INVALID_PATIENT');
  const doctor = req.doctor;

  let appointment = null;
  if (data.appointment) {
    appointment = await Appointment.findById(data.appointment);
    if (!appointment) throw ApiError.badRequest('Appointment does not exist', 'INVALID_APPOINTMENT');
    if (String(appointment.doctor) !== String(doctor._id) || String(appointment.patient) !== String(patient._id)) {
      throw ApiError.forbidden('Appointment is not assigned to you for this patient', 'APPOINTMENT_NOT_ASSIGNED');
    }
    const existing = await Encounter.findOne({ appointment: appointment._id });
    if (existing) {
      throw ApiError.conflict('An encounter already exists for this appointment', 'ENCOUNTER_EXISTS', { encounterId: existing.encounterId });
    }
  } else {
    const allowed = await doctorCanAccessPatient(doctor._id, patient._id);
    if (!allowed) throw ApiError.forbidden('This patient is not assigned to you', 'PATIENT_NOT_ASSIGNED');
  }

  const encounterId = await nextId('encounter', 'ENC');
  const encounter = await Encounter.create({
    ...data,
    encounterId,
    doctor: doctor._id,
    createdBy: req.user._id,
    appointment: data.appointment || undefined,
    followUpDate: data.followUpDate || undefined,
  });

  if (appointment && ['BOOKED', 'CONFIRMED', 'CHECKED_IN'].includes(appointment.status)) {
    appointment.status = 'IN_PROGRESS';
    await appointment.save();
  }

  await auditFromRequest(req, {
    action: 'ENCOUNTER_CREATED',
    resourceType: 'Encounter',
    resourceId: encounter.encounterId,
    metadata: { patient: patient.patientId },
  });
  return Encounter.findById(encounter._id).populate('patient', 'firstName lastName patientId').populate('doctor', 'firstName lastName doctorId').lean();
}

async function listEncounters(query, req) {
  assertClinicalAllowed(req);
  const { page, limit, skip } = getPagination(query);
  const filter = { ...doctorScope(req) };
  if (query.patient) filter.patient = query.patient;
  if (query.doctor && req.user.role === 'ADMIN') filter.doctor = query.doctor;
  if (query.status) filter.status = query.status;
  Object.assign(filter, dateRangeFilter('encounterDate', query));
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    const patients = await Patient.find({ $or: [{ firstName: regex }, { lastName: regex }, { patientId: regex }] }).select('_id').limit(200).lean();
    filter.$or = [{ encounterId: regex }, { chiefComplaint: regex }, { patient: { $in: patients.map((p) => p._id) } }];
  }
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt', 'encounterDate'], { encounterDate: -1 });
  const [items, total] = await Promise.all([
    Encounter.find(filter)
      .populate('patient', 'firstName lastName patientId')
      .populate('doctor', 'firstName lastName doctorId specialization')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Encounter.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
}

async function getEncounter(id, req) {
  assertClinicalAllowed(req);
  const encounter = await Encounter.findById(id)
    .populate('patient', 'firstName lastName patientId gender dateOfBirth')
    .populate('doctor', 'firstName lastName doctorId specialization')
    .populate('appointment', 'appointmentNumber date startTime status')
    .lean();
  if (!encounter) throw ApiError.notFound('Encounter not found', 'ENCOUNTER_NOT_FOUND');
  if (req.user.role === 'DOCTOR' && String(encounter.doctor?._id) !== String(req.doctor._id)) {
    throw ApiError.forbidden('This encounter is not assigned to you', 'ENCOUNTER_NOT_ASSIGNED');
  }
  return encounter;
}

async function updateEncounter(id, data, req) {
  if (req.user.role !== 'DOCTOR') {
    throw ApiError.forbidden('Only clinicians can update encounter records', 'ROLE_FORBIDDEN');
  }
  const encounter = await Encounter.findById(id);
  if (!encounter) throw ApiError.notFound('Encounter not found', 'ENCOUNTER_NOT_FOUND');
  if (String(encounter.doctor) !== String(req.doctor._id)) {
    throw ApiError.forbidden('This encounter is not assigned to you', 'ENCOUNTER_NOT_ASSIGNED');
  }
  if (['COMPLETED', 'CANCELLED'].includes(encounter.status) && data.status !== 'COMPLETED') {
    throw ApiError.conflict('Completed or cancelled encounters are read-only', 'ENCOUNTER_LOCKED');
  }
  const previousNotes = encounter.clinicalNotes;
  const allowed = ['visitType', 'chiefComplaint', 'clinicalNotes', 'vitalSigns', 'treatmentNotes', 'followUpDate', 'status', 'encounterDate'];
  for (const key of allowed) {
    if (data[key] !== undefined) encounter[key] = data[key] === '' ? undefined : data[key];
  }
  await encounter.save();
  const notesChanged = previousNotes !== encounter.clinicalNotes;
  await auditFromRequest(req, {
    action: notesChanged ? 'CLINICAL_NOTES_UPDATED' : 'ENCOUNTER_UPDATED',
    resourceType: 'Encounter',
    resourceId: encounter.encounterId,
    metadata: { fields: Object.keys(data) },
  });
  if (encounter.status === 'COMPLETED' && encounter.appointment) {
    await Appointment.updateOne({ _id: encounter.appointment, status: { $ne: 'CANCELLED' } }, { $set: { status: 'COMPLETED' } });
  }
  return Encounter.findById(id).populate('patient', 'firstName lastName patientId').populate('doctor', 'firstName lastName').lean();
}

/* --------------------------- Prescriptions -------------------------- */

async function createPrescription(data, req) {
  if (req.user.role !== 'DOCTOR') {
    throw ApiError.forbidden('Only clinicians can create prescriptions', 'ROLE_FORBIDDEN');
  }
  const encounter = await Encounter.findById(data.encounter);
  if (!encounter) throw ApiError.badRequest('Encounter does not exist', 'INVALID_ENCOUNTER');
  if (String(encounter.doctor) !== String(req.doctor._id)) {
    throw ApiError.forbidden('This encounter is not assigned to you', 'ENCOUNTER_NOT_ASSIGNED');
  }
  if (String(encounter.patient) !== String(data.patient)) {
    throw ApiError.badRequest('Patient does not match the encounter', 'PATIENT_MISMATCH');
  }
  if (encounter.status === 'CANCELLED') throw ApiError.conflict('Cannot prescribe on a cancelled encounter', 'ENCOUNTER_CANCELLED');
  const prescriptionId = await nextId('prescription', 'RX');
  const prescription = await Prescription.create({
    ...data,
    prescriptionId,
    doctor: req.doctor._id,
    createdBy: req.user._id,
  });
  await auditFromRequest(req, {
    action: 'PRESCRIPTION_CREATED',
    resourceType: 'Prescription',
    resourceId: prescription.prescriptionId,
    metadata: { encounter: encounter.encounterId, medicineCount: data.medicines.length },
  });
  return Prescription.findById(prescription._id)
    .populate('patient', 'firstName lastName patientId')
    .populate('doctor', 'firstName lastName doctorId')
    .populate('encounter', 'encounterId encounterDate')
    .lean();
}

async function listPrescriptions(query, req) {
  assertClinicalAllowed(req);
  const { page, limit, skip } = getPagination(query);
  const filter = { ...doctorScope(req) };
  if (query.patient) filter.patient = query.patient;
  if (query.encounter) filter.encounter = query.encounter;
  if (query.doctor && req.user.role === 'ADMIN') filter.doctor = query.doctor;
  Object.assign(filter, dateRangeFilter('prescriptionDate', query));
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    const patients = await Patient.find({ $or: [{ firstName: regex }, { lastName: regex }, { patientId: regex }] }).select('_id').limit(200).lean();
    filter.$or = [{ prescriptionId: regex }, { 'medicines.name': regex }, { patient: { $in: patients.map((p) => p._id) } }];
  }
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt', 'prescriptionDate'], { prescriptionDate: -1 });
  const [items, total] = await Promise.all([
    Prescription.find(filter)
      .populate('patient', 'firstName lastName patientId')
      .populate('doctor', 'firstName lastName doctorId')
      .populate('encounter', 'encounterId')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Prescription.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
}

async function getPrescription(id, req) {
  assertClinicalAllowed(req);
  const prescription = await Prescription.findById(id)
    .populate('patient', 'firstName lastName patientId gender dateOfBirth phone')
    .populate('doctor', 'firstName lastName doctorId specialization')
    .populate('encounter', 'encounterId encounterDate chiefComplaint')
    .lean();
  if (!prescription) throw ApiError.notFound('Prescription not found', 'PRESCRIPTION_NOT_FOUND');
  if (req.user.role === 'DOCTOR' && String(prescription.doctor?._id) !== String(req.doctor._id)) {
    throw ApiError.forbidden('This prescription is not assigned to you', 'PRESCRIPTION_NOT_ASSIGNED');
  }
  return prescription;
}

async function updatePrescription(id, data, req) {
  if (req.user.role !== 'DOCTOR') {
    throw ApiError.forbidden('Only clinicians can modify prescriptions', 'ROLE_FORBIDDEN');
  }
  const prescription = await Prescription.findById(id);
  if (!prescription) throw ApiError.notFound('Prescription not found', 'PRESCRIPTION_NOT_FOUND');
  if (String(prescription.doctor) !== String(req.doctor._id)) {
    throw ApiError.forbidden('This prescription is not assigned to you', 'PRESCRIPTION_NOT_ASSIGNED');
  }
  if (data.medicines) prescription.medicines = data.medicines;
  if (data.notes !== undefined) prescription.notes = data.notes;
  if (data.prescriptionDate) prescription.prescriptionDate = data.prescriptionDate;
  await prescription.save();
  await auditFromRequest(req, {
    action: 'PRESCRIPTION_UPDATED',
    resourceType: 'Prescription',
    resourceId: prescription.prescriptionId,
    metadata: { fields: Object.keys(data) },
  });
  return getPrescription(id, req);
}

/* -------------------------- Diagnostic reports ---------------------- */

async function createDiagnosticReport(data, req) {
  if (req.user.role !== 'DOCTOR') {
    throw ApiError.forbidden('Only clinicians can create diagnostic reports', 'ROLE_FORBIDDEN');
  }
  const patient = await Patient.findById(data.patient);
  if (!patient) throw ApiError.badRequest('Patient does not exist', 'INVALID_PATIENT');
  let encounter = null;
  if (data.encounter) {
    encounter = await Encounter.findById(data.encounter);
    if (!encounter) throw ApiError.badRequest('Encounter does not exist', 'INVALID_ENCOUNTER');
    if (String(encounter.doctor) !== String(req.doctor._id) || String(encounter.patient) !== String(patient._id)) {
      throw ApiError.forbidden('This encounter is not assigned to you for this patient', 'ENCOUNTER_NOT_ASSIGNED');
    }
  } else {
    const allowed = await doctorCanAccessPatient(req.doctor._id, patient._id);
    if (!allowed) throw ApiError.forbidden('This patient is not assigned to you', 'PATIENT_NOT_ASSIGNED');
  }
  const reportId = await nextId('report', 'DR');
  const report = await DiagnosticReport.create({
    ...data,
    reportId,
    doctor: req.doctor._id,
    encounter: data.encounter || undefined,
    createdBy: req.user._id,
  });
  await auditFromRequest(req, {
    action: 'DIAGNOSTIC_REPORT_CREATED',
    resourceType: 'DiagnosticReport',
    resourceId: report.reportId,
    metadata: { patient: patient.patientId, testName: report.testName },
  });
  return DiagnosticReport.findById(report._id)
    .populate('patient', 'firstName lastName patientId')
    .populate('doctor', 'firstName lastName doctorId')
    .lean();
}

async function listDiagnosticReports(query, req) {
  assertClinicalAllowed(req);
  const { page, limit, skip } = getPagination(query);
  const filter = { ...doctorScope(req) };
  if (query.patient) filter.patient = query.patient;
  if (query.encounter) filter.encounter = query.encounter;
  if (query.doctor && req.user.role === 'ADMIN') filter.doctor = query.doctor;
  if (query.status) filter.status = query.status;
  if (query.testCategory) filter.testCategory = new RegExp(escapeRegex(query.testCategory), 'i');
  Object.assign(filter, dateRangeFilter('reportDate', query));
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    const patients = await Patient.find({ $or: [{ firstName: regex }, { lastName: regex }, { patientId: regex }] }).select('_id').limit(200).lean();
    filter.$or = [{ reportId: regex }, { testName: regex }, { testCategory: regex }, { patient: { $in: patients.map((p) => p._id) } }];
  }
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt', 'reportDate'], { reportDate: -1 });
  const [items, total] = await Promise.all([
    DiagnosticReport.find(filter)
      .populate('patient', 'firstName lastName patientId')
      .populate('doctor', 'firstName lastName doctorId')
      .populate('encounter', 'encounterId')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    DiagnosticReport.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
}

async function getDiagnosticReport(id, req) {
  assertClinicalAllowed(req);
  const report = await DiagnosticReport.findById(id)
    .populate('patient', 'firstName lastName patientId gender dateOfBirth')
    .populate('doctor', 'firstName lastName doctorId specialization')
    .populate('encounter', 'encounterId encounterDate')
    .lean();
  if (!report) throw ApiError.notFound('Diagnostic report not found', 'REPORT_NOT_FOUND');
  if (req.user.role === 'DOCTOR' && String(report.doctor?._id) !== String(req.doctor._id)) {
    throw ApiError.forbidden('This report is not assigned to you', 'REPORT_NOT_ASSIGNED');
  }
  return report;
}

async function updateDiagnosticReport(id, data, req) {
  assertClinicalAllowed(req);
  const report = await DiagnosticReport.findById(id);
  if (!report) throw ApiError.notFound('Diagnostic report not found', 'REPORT_NOT_FOUND');
  if (req.user.role === 'DOCTOR' && String(report.doctor) !== String(req.doctor._id)) {
    throw ApiError.forbidden('This report is not assigned to you', 'REPORT_NOT_ASSIGNED');
  }
  const allowed = ['testName', 'testCategory', 'reportDate', 'status', 'notes', 'fileReference'];
  for (const key of allowed) {
    if (data[key] !== undefined) report[key] = data[key];
  }
  await report.save();
  await auditFromRequest(req, {
    action: 'DIAGNOSTIC_REPORT_UPDATED',
    resourceType: 'DiagnosticReport',
    resourceId: report.reportId,
    metadata: { fields: Object.keys(data) },
  });
  return report;
}

module.exports = {
  createEncounter,
  listEncounters,
  getEncounter,
  updateEncounter,
  createPrescription,
  listPrescriptions,
  getPrescription,
  updatePrescription,
  createDiagnosticReport,
  listDiagnosticReports,
  getDiagnosticReport,
  updateDiagnosticReport,
};
