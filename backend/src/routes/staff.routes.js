const express = require('express');
const controller = require('../controllers/staff.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createStaffSchema, updateStaffSchema, updateStaffStatusSchema, listStaffQuery } = require('../validators/staff.validators');
const { idParam } = require('../validators/common');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/', validate({ query: listStaffQuery }), controller.list);
router.post('/', validate({ body: createStaffSchema }), controller.create);
router.get('/:id', validate({ params: idParam }), controller.getOne);
router.put('/:id', validate({ params: idParam, body: updateStaffSchema }), controller.update);
router.patch('/:id/status', validate({ params: idParam, body: updateStaffStatusSchema }), controller.setStatus);

module.exports = router;
