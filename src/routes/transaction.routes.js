const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/transaction.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.post('/transfer', ctrl.transfer);
router.get('/report', ctrl.monthlyReport);
router.get('/', ctrl.listTransactions);

module.exports = router;
