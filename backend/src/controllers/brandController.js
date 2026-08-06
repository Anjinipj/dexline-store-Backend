const brandService = require('../services/brandService');
const brandPresenter = require('../presenters/brandPresenter');

async function listBrands(req, res, next) {
  try {
    const { brands, pagination } = await brandService.list(req.query);
    res.json({ brands: brandPresenter.toListView(brands), pagination });
  } catch (err) {
    next(err);
  }
}

async function listAllBrandsAdmin(req, res, next) {
  try {
    const { brands, pagination } = await brandService.listAllAdmin(req.query);
    res.json({ brands: brandPresenter.toListView(brands), pagination });
  } catch (err) {
    next(err);
  }
}

async function getBrandBySlug(req, res, next) {
  try {
    const brand = await brandService.getBySlug(req.params.slug);
    res.json({ brand: brandPresenter.toView(brand) });
  } catch (err) {
    next(err);
  }
}

async function getBrandById(req, res, next) {
  try {
    const brand = await brandService.getById(req.params.id);
    res.json({ brand: brandPresenter.toView(brand) });
  } catch (err) {
    next(err);
  }
}

async function createBrand(req, res, next) {
  try {
    const brand = await brandService.create(req.body);
    res.status(201).json({ brand: brandPresenter.toView(brand) });
  } catch (err) {
    next(err);
  }
}

async function updateBrand(req, res, next) {
  try {
    const brand = await brandService.update(req.params.id, req.body);
    res.json({ brand: brandPresenter.toView(brand) });
  } catch (err) {
    next(err);
  }
}

async function deleteBrand(req, res, next) {
  try {
    await brandService.remove(req.params.id);
    res.json({ message: 'Brand deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBrands,
  listAllBrandsAdmin,
  getBrandBySlug,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
};
