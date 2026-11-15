const express = require('express');
const controller = require('../controllers/patient.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createPatientSchema,
  updatePatientSchema,
  updateStatusSchema,
  listPatientQuery,
  patientIdParam,
} = require('../validators/patient.validators');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), validate({ query: listPatientQuery }), controller.list);
router.post('/', authorize('ADMIN', 'RECEPTIONIST'), validate({ body: createPatientSchema }), controller.create);
router.get('/:id/history', authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), validate({ params: patientIdParam }), controller.history);
router.get('/:id', authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), validate({ params: patientIdParam }), controller.getOne);
router.put('/:id', authorize('ADMIN', 'RECEPTIONIST'), validate({ params: patientIdParam, body: updatePatientSchema }), controller.update);
router.patch('/:id/status', authorize('ADMIN'), validate({ params: patientIdParam, body: updateStatusSchema }), controller.setStatus);

module.exports = router;
