const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/budget.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.post('/', ctrl.setBudget);
router.get('/', ctrl.listBudget);
router.get('/status', ctrl.budgetStatus);

module.exports = router;
