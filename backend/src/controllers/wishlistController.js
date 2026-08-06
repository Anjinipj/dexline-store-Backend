const wishlistService = require('../services/wishlistService');
const wishlistPresenter = require('../presenters/wishlistPresenter');

async function getWishlist(req, res, next) {
  try {
    const items = await wishlistService.getItems(req.user.id);
    res.json({ wishlist: wishlistPresenter.toView(items) });
  } catch (err) {
    next(err);
  }
}

async function addItem(req, res, next) {
  try {
    const items = await wishlistService.addItem(req.user.id, req.body);
    res.json({ wishlist: wishlistPresenter.toView(items) });
  } catch (err) {
    next(err);
  }
}

async function removeItem(req, res, next) {
  try {
    const items = await wishlistService.removeItem(req.user.id, req.params.productId);
    res.json({ wishlist: wishlistPresenter.toView(items) });
  } catch (err) {
    next(err);
  }
}

module.exports = { getWishlist, addItem, removeItem };
