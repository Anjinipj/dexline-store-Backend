const express = require('express');
const { upload } = require('../middleware/upload');
const { uploadImages } = require('../controllers/uploadController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, adminOnly, upload.array('images', 6), uploadImages);

module.exports = router;
