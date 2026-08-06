const express = require('express');
const {
  listBanners,
  listAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
} = require('../controllers/bannerController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', listBanners);
router.get('/admin/all', protect, adminOnly, listAllBanners);
router.get('/admin/:id', protect, adminOnly, getBannerById);
router.post('/', protect, adminOnly, createBanner);
router.put('/:id', protect, adminOnly, updateBanner);
router.delete('/:id', protect, adminOnly, deleteBanner);

module.exports = router;
