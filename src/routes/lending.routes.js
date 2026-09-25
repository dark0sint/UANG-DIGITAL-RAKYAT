const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/lending.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.post('/offer', ctrl.createOffer);
router.post('/request', ctrl.createRequest);
router.get('/', ctrl.list);
router.post('/:id/fund', ctrl.fund);
router.post('/:id/accept', ctrl.acceptOffer);
router.post('/:id/repay', ctrl.repay);

module.exports = router;
