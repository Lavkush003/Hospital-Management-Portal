const express = require('express');
const controller = require('../controllers/audit.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { auditQuery } = require('../validators/misc.validators');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/', validate({ query: auditQuery }), controller.list);

module.exports = router;
