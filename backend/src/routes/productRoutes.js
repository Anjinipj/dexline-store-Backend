const express = require('express');
const {
  listProducts,
  listAllProductsAdmin,
  getProductBySlug,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', listProducts);
router.get('/slug/:slug', getProductBySlug);
router.get('/admin/all', protect, adminOnly, listAllProductsAdmin);
router.get('/admin/:id', protect, adminOnly, getProductById);
router.post('/', protect, adminOnly, createProduct);
router.put('/:id', protect, adminOnly, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);

module.exports = router;
