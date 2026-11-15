const express = require('express');
const controller = require('../controllers/doctor.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createDoctorSchema,
  updateDoctorSchema,
  updateDoctorStatusSchema,
  listDoctorQuery,
  availabilityQuery,
} = require('../validators/doctor.validators');
const { idParam } = require('../validators/common');

const router = express.Router();
router.use(authenticate);

router.get('/', validate({ query: listDoctorQuery }), controller.list);
router.post('/', authorize('ADMIN'), validate({ body: createDoctorSchema }), controller.create);
router.get('/:id/availability', validate({ params: idParam, query: availabilityQuery }), controller.availability);
router.get('/:id', validate({ params: idParam }), controller.getOne);
router.put('/:id', authorize('ADMIN'), validate({ params: idParam, body: updateDoctorSchema }), controller.update);
router.patch('/:id/status', authorize('ADMIN'), validate({ params: idParam, body: updateDoctorStatusSchema }), controller.setStatus);

module.exports = router;
