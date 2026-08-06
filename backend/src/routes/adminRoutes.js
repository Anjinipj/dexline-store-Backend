const express = require('express');
const { getDashboardStats } = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect, adminOnly);

router.get('/dashboard', getDashboardStats);

module.exports = router;
