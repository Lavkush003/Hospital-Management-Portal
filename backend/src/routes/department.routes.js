const express = require('express');
const controller = require('../controllers/department.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createDepartmentSchema, updateDepartmentSchema, listDepartmentQuery } = require('../validators/department.validators');
const { idParam } = require('../validators/common');

const router = express.Router();
router.use(authenticate);

router.get('/', validate({ query: listDepartmentQuery }), controller.list);
router.post('/', authorize('ADMIN'), validate({ body: createDepartmentSchema }), controller.create);
router.get('/:id', validate({ params: idParam }), controller.getOne);
router.put('/:id', authorize('ADMIN'), validate({ params: idParam, body: updateDepartmentSchema }), controller.update);
router.delete('/:id', authorize('ADMIN'), validate({ params: idParam }), controller.remove);

module.exports = router;
