const express = require('express');
const { getSalesReport, getInventoryReport } = require('../controllers/reportController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect, adminOnly);

router.get('/sales', getSalesReport);
router.get('/inventory', getInventoryReport);

module.exports = router;
