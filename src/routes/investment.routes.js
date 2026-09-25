const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/investment.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/products', ctrl.listProducts);
router.post('/buy', ctrl.buy);
router.post('/sell', ctrl.sell);
router.get('/portfolio', ctrl.portfolio);

module.exports = router;
