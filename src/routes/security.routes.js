const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/security.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.post('/block', ctrl.blockSelf);
router.post('/unblock', ctrl.unblockSelf);
router.post('/change-pin', ctrl.changePin);
router.get('/logs', ctrl.getLogs);

module.exports = router;
