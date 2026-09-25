const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paylater.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.post('/apply', ctrl.apply);
router.get('/', ctrl.getMyPaylater);
router.post('/transaction', ctrl.useForTransaction);
router.post('/pay-bill', ctrl.payBill);

module.exports = router;
