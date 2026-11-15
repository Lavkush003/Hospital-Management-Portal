const express = require('express');
const controller = require('../controllers/appointment.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  updateAppointmentSchema,
  updateStatusSchema,
  cancelSchema,
  listAppointmentQuery,
  appointmentIdParam,
} = require('../validators/appointment.validators');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), validate({ query: listAppointmentQuery }), controller.list);
router.post('/', authorize('ADMIN', 'RECEPTIONIST'), validate({ body: createAppointmentSchema }), controller.create);
router.get('/:id', authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), validate({ params: appointmentIdParam }), controller.getOne);
router.put('/:id', authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), validate({ params: appointmentIdParam, body: updateAppointmentSchema }), controller.update);
router.patch('/:id/reschedule', authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), validate({ params: appointmentIdParam, body: rescheduleAppointmentSchema }), controller.reschedule);
router.patch('/:id/cancel', authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), validate({ params: appointmentIdParam, body: cancelSchema }), controller.cancel);
router.patch('/:id/status', authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), validate({ params: appointmentIdParam, body: updateStatusSchema }), controller.updateStatus);

module.exports = router;
