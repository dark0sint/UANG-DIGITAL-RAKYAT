const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/wallet.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', ctrl.getWallet);
router.post('/topup', ctrl.topup);

module.exports = router;
