const cartService = require('../services/cartService');
const cartPresenter = require('../presenters/cartPresenter');

async function getCart(req, res, next) {
  try {
    const items = await cartService.getCart(req.user.id);
    res.json({ cart: cartPresenter.toView(items) });
  } catch (err) {
    next(err);
  }
}

async function addItem(req, res, next) {
  try {
    const items = await cartService.addItem(req.user.id, req.body);
    res.json({ cart: cartPresenter.toView(items) });
  } catch (err) {
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const items = await cartService.updateItem(req.user.id, req.params.productId, req.body);
    res.json({ cart: cartPresenter.toView(items) });
  } catch (err) {
    next(err);
  }
}

async function removeItem(req, res, next) {
  try {
    const items = await cartService.removeItem(req.user.id, req.params.productId);
    res.json({ cart: cartPresenter.toView(items) });
  } catch (err) {
    next(err);
  }
}

async function clearCart(req, res, next) {
  try {
    await cartService.clearCart(req.user.id);
    res.json({ cart: cartPresenter.toView([]) });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
