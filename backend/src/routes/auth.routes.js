const express = require('express');
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const optionalAuthenticate = require('../middleware/optionalAuthenticate');
const { authLimiter } = require('../middleware/rateLimit');
const { loginSchema, changePasswordSchema } = require('../validators/auth.validators');

const router = express.Router();

router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
router.post('/logout', optionalAuthenticate, controller.logout);
router.get('/me', authenticate, controller.me);
router.post('/change-password', authenticate, validate({ body: changePasswordSchema }), controller.changePassword);

module.exports = router;
