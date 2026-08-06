const bannerService = require('../services/bannerService');
const bannerPresenter = require('../presenters/bannerPresenter');

async function listBanners(req, res, next) {
  try {
    const banners = await bannerService.listActive();
    res.json({ banners: bannerPresenter.toListView(banners) });
  } catch (err) {
    next(err);
  }
}

async function listAllBanners(req, res, next) {
  try {
    const banners = await bannerService.listAll();
    res.json({ banners: bannerPresenter.toListView(banners) });
  } catch (err) {
    next(err);
  }
}

async function getBannerById(req, res, next) {
  try {
    const banner = await bannerService.getById(req.params.id);
    res.json({ banner: bannerPresenter.toView(banner) });
  } catch (err) {
    next(err);
  }
}

async function createBanner(req, res, next) {
  try {
    const banner = await bannerService.create(req.body);
    res.status(201).json({ banner: bannerPresenter.toView(banner) });
  } catch (err) {
    next(err);
  }
}

async function updateBanner(req, res, next) {
  try {
    const banner = await bannerService.update(req.params.id, req.body);
    res.json({ banner: bannerPresenter.toView(banner) });
  } catch (err) {
    next(err);
  }
}

async function deleteBanner(req, res, next) {
  try {
    await bannerService.remove(req.params.id);
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
