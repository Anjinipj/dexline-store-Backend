const Banner = require('../models/Banner');

async function listBanners(req, res, next) {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    res.json({ banners });
  } catch (err) {
    next(err);
  }
}

async function listAllBanners(req, res, next) {
  try {
    const banners = await Banner.find({}).sort({ order: 1, createdAt: 1 });
    res.json({ banners });
  } catch (err) {
    next(err);
  }
}

async function getBannerById(req, res, next) {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    res.json({ banner });
  } catch (err) {
    next(err);
  }
}

async function createBanner(req, res, next) {
  try {
    const { image, badge, title, description, buttonText, linkHref, order, isActive } = req.body;

    if (!image || !title) {
      return res.status(400).json({ message: 'Image and title are required' });
    }

    const banner = await Banner.create({
      image,
      badge,
      title,
      description,
      buttonText,
      linkHref,
      order,
      isActive,
    });

    res.status(201).json({ banner });
  } catch (err) {
    next(err);
  }
}

async function updateBanner(req, res, next) {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    const fields = ['image', 'badge', 'title', 'description', 'buttonText', 'linkHref', 'order', 'isActive'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) banner[field] = req.body[field];
    });

    await banner.save();
    res.json({ banner });
  } catch (err) {
    next(err);
  }
}

async function deleteBanner(req, res, next) {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    res.json({ message: 'Banner deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBanners,
  listAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
};
