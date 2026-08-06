const productService = require('../services/productService');
const productPresenter = require('../presenters/productPresenter');

async function listProducts(req, res, next) {
  try {
    const { products, pagination } = await productService.list(req.query);
    res.json({ products: productPresenter.toListView(products), pagination });
  } catch (err) {
    next(err);
  }
}

async function listAllProductsAdmin(req, res, next) {
  try {
    const { products, pagination } = await productService.listAllAdmin(req.query);
    res.json({ products: productPresenter.toListView(products), pagination });
  } catch (err) {
    next(err);
  }
}

async function getProductBySlug(req, res, next) {
  try {
    const product = await productService.getBySlug(req.params.slug);
    res.json({ product: productPresenter.toView(product) });
  } catch (err) {
    next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const product = await productService.getById(req.params.id);
    res.json({ product: productPresenter.toView(product) });
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const product = await productService.create(req.body);
    res.status(201).json({ product: productPresenter.toView(product) });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await productService.update(req.params.id, req.body);
    res.json({ product: productPresenter.toView(product) });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    await productService.remove(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  listAllProductsAdmin,
  getProductBySlug,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
