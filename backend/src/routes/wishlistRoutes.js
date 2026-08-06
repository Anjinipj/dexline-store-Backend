const express = require('express');
const { getWishlist, addItem, removeItem } = require('../controllers/wishlistController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getWishlist);
router.post('/items', addItem);
router.delete('/items/:productId', removeItem);

module.exports = router;
