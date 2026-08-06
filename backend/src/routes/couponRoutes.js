const express = require('express');
const {
  listAllAdmin,
  getById,
  create,
  update,
  remove,
  validateCoupon,
} = require('../controllers/couponController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.post('/validate', protect, validateCoupon);

router.get('/admin/all', protect, adminOnly, listAllAdmin);
router.get('/admin/:id', protect, adminOnly, getById);
router.post('/', protect, adminOnly, create);
router.put('/:id', protect, adminOnly, update);
router.delete('/:id', protect, adminOnly, remove);

module.exports = router;
