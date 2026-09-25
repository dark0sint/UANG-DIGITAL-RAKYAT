const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/va.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.post('/', ctrl.createVA);
router.get('/', ctrl.listVA);
router.post('/:vaNumber/pay', ctrl.payToVA);

module.exports = router;
