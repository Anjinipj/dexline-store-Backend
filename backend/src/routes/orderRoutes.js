const express = require('express');
const {
  createOrder,
  getMyOrders,
  getMyOrderById,
  listOrdersAdmin,
  getOrderByIdAdmin,
  updateOrderStatus,
} = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/', createOrder);
router.get('/mine', getMyOrders);
router.get('/mine/:id', getMyOrderById);

router.get('/admin/all', adminOnly, listOrdersAdmin);
router.get('/admin/:id', adminOnly, getOrderByIdAdmin);
router.put('/admin/:id/status', adminOnly, updateOrderStatus);

module.exports = router;
