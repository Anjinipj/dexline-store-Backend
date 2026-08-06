const categoryService = require('../services/categoryService');
const categoryPresenter = require('../presenters/categoryPresenter');

async function listCategories(req, res, next) {
  try {
    const categories = await categoryService.listActive();
    res.json({ categories: categoryPresenter.toListView(categories) });
  } catch (err) {
    next(err);
  }
}

async function listAllCategories(req, res, next) {
  try {
    const categories = await categoryService.listAll();
    res.json({ categories: categoryPresenter.toListView(categories) });
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const category = await categoryService.create(req.body);
    res.status(201).json({ category: categoryPresenter.toView(category) });
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const category = await categoryService.update(req.params.id, req.body);
    res.json({ category: categoryPresenter.toView(category) });
  } catch (err) {
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    await categoryService.remove(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCategories,
  listAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
