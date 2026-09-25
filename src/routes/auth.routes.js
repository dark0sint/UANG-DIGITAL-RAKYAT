const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auth.controller');
const { requireAuth, requireTempAuth } = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/2fa/login-verify', requireTempAuth, ctrl.loginVerify2FA);
router.post('/biometric/login', ctrl.loginBiometric);

router.get('/me', requireAuth, ctrl.me);
router.post('/2fa/setup', requireAuth, ctrl.setup2FA);
router.post('/2fa/verify', requireAuth, ctrl.verify2FA);
router.post('/2fa/disable', requireAuth, ctrl.disable2FA);
router.post('/biometric/register', requireAuth, ctrl.registerBiometric);

module.exports = router;
