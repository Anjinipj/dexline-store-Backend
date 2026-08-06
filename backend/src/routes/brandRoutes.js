const express = require('express');
const {
  listBrands,
  listAllBrandsAdmin,
  getBrandBySlug,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
} = require('../controllers/brandController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', listBrands);
router.get('/slug/:slug', getBrandBySlug);
router.get('/admin/all', protect, adminOnly, listAllBrandsAdmin);
router.get('/admin/:id', protect, adminOnly, getBrandById);
router.post('/', protect, adminOnly, createBrand);
router.put('/:id', protect, adminOnly, updateBrand);
router.delete('/:id', protect, adminOnly, deleteBrand);

module.exports = router;
