const express = require('express');
const {
  listBanners,
  listAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
} = require('../controllers/bannerController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', listBanners);
router.get('/admin/all', protect, adminOnly, listAllBanners);
router.get('/admin/:id', protect, adminOnly, getBannerById);
router.post('/', protect, adminOnly, createBanner);
// Must be declared before '/:id' so "reorder" isn't read as a banner id.
router.put('/reorder', protect, adminOnly, reorderBanners);
router.put('/:id', protect, adminOnly, updateBanner);
router.delete('/:id', protect, adminOnly, deleteBanner);

module.exports = router;
