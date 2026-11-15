const express = require('express');
const controller = require('../controllers/clinical.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createEncounterSchema,
  updateEncounterSchema,
  listEncounterQuery,
} = require('../validators/encounter.validators');
const {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  listPrescriptionQuery,
} = require('../validators/prescription.validators');
const { createReportSchema, updateReportSchema, listReportQuery } = require('../validators/report.validators');
const { idParam } = require('../validators/common');

const encounters = express.Router();
encounters.use(authenticate, authorize('ADMIN', 'DOCTOR'));
encounters.get('/', validate({ query: listEncounterQuery }), controller.listEncounters);
encounters.post('/', authorize('DOCTOR'), validate({ body: createEncounterSchema }), controller.createEncounter);
encounters.get('/:id', validate({ params: idParam }), controller.getEncounter);
encounters.put('/:id', authorize('DOCTOR'), validate({ params: idParam, body: updateEncounterSchema }), controller.updateEncounter);

const prescriptions = express.Router();
prescriptions.use(authenticate, authorize('ADMIN', 'DOCTOR'));
prescriptions.get('/', validate({ query: listPrescriptionQuery }), controller.listPrescriptions);
prescriptions.post('/', authorize('DOCTOR'), validate({ body: createPrescriptionSchema }), controller.createPrescription);
prescriptions.get('/:id', validate({ params: idParam }), controller.getPrescription);
prescriptions.put('/:id', authorize('DOCTOR'), validate({ params: idParam, body: updatePrescriptionSchema }), controller.updatePrescription);

const reports = express.Router();
reports.use(authenticate, authorize('ADMIN', 'DOCTOR'));
reports.get('/', validate({ query: listReportQuery }), controller.listReports);
reports.post('/', authorize('DOCTOR'), validate({ body: createReportSchema }), controller.createReport);
reports.get('/:id', validate({ params: idParam }), controller.getReport);
reports.put('/:id', authorize('ADMIN', 'DOCTOR'), validate({ params: idParam, body: updateReportSchema }), controller.updateReport);

module.exports = { encounters, prescriptions, reports };
