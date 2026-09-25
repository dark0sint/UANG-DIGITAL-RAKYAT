const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/qris.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.post('/generate', ctrl.generate);
router.post('/pay', ctrl.pay);
router.get('/:code', ctrl.getByCode);

module.exports = router;
