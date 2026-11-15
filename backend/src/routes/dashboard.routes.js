const express = require('express');
const controller = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

router.get('/admin', authorize('ADMIN'), controller.admin);
router.get('/receptionist', authorize('ADMIN', 'RECEPTIONIST'), controller.receptionist);
router.get('/doctor', authorize('DOCTOR'), controller.doctor);

module.exports = router;
