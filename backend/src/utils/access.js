const AppError = require('./ApiError');
const Appointment = require('../models/Appointment');
const Encounter = require('../models/Encounter');

async function doctorCanAccessPatient(doctorId, patientId) {
  const [appointment, encounter] = await Promise.all([
    Appointment.exists({ doctor: doctorId, patient: patientId }),
    Encounter.exists({ doctor: doctorId, patient: patientId }),
  ]);
  return Boolean(appointment || encounter);
}

async function assertDoctorPatientAccess(req, patientId) {
  if (req.user.role !== 'DOCTOR') return;
  const allowed = await doctorCanAccessPatient(req.doctor._id, patientId);
  if (!allowed) {
    throw AppError.forbidden('This patient is not assigned to you', 'PATIENT_NOT_ASSIGNED');
  }
}

function assertClinicalRead(req) {
  if (!['ADMIN', 'DOCTOR'].includes(req.user.role)) {
    throw AppError.forbidden('Clinical records are restricted to clinicians and administrators', 'CLINICAL_FORBIDDEN');
  }
}

module.exports = { doctorCanAccessPatient, assertDoctorPatientAccess, assertClinicalRead };
