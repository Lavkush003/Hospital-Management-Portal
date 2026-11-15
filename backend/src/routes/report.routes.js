const express = require('express');
const controller = require('../controllers/report.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { reportQuery } = require('../validators/misc.validators');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/appointments', validate({ query: reportQuery }), controller.appointments);
router.get('/revenue', validate({ query: reportQuery }), controller.revenue);
router.get('/patients', validate({ query: reportQuery }), controller.patients);
router.get('/departments', validate({ query: reportQuery }), controller.departments);

module.exports = router;
