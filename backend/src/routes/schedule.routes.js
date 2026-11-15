const express = require('express');
const controller = require('../controllers/schedule.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createScheduleSchema, updateScheduleSchema, listScheduleQuery } = require('../validators/schedule.validators');
const { idParam } = require('../validators/common');

const router = express.Router();
router.use(authenticate);

router.get('/', validate({ query: listScheduleQuery }), controller.list);
router.post('/', authorize('ADMIN'), validate({ body: createScheduleSchema }), controller.create);
router.put('/:id', authorize('ADMIN'), validate({ params: idParam, body: updateScheduleSchema }), controller.update);
router.delete('/:id', authorize('ADMIN'), validate({ params: idParam }), controller.remove);

module.exports = router;
