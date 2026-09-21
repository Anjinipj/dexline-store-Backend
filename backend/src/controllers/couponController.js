const couponService = require('../services/couponService');
const couponPresenter = require('../presenters/couponPresenter');
const cartService = require('../services/cartService');
const pricingService = require('../services/pricingService');

async function listAllAdmin(req, res, next) {
  try {
    const { coupons, pagination } = await couponService.listAllAdmin(req.query);
    res.json({ coupons: couponPresenter.toListView(coupons), pagination });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const coupon = await couponService.getById(req.params.id);
    res.json({ coupon: couponPresenter.toView(coupon) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const coupon = await couponService.create(req.body);
    res.status(201).json({ coupon: couponPresenter.toView(coupon) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const coupon = await couponService.update(req.params.id, req.body);
    res.json({ coupon: couponPresenter.toView(coupon) });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await couponService.remove(req.params.id);
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    next(err);
  }
}

// Previously trusted a client-sent `subtotal` for the min-order check (this
// endpoint is preview-only, never the one that persists an order — see
// orderService.createOrder for the actually-trusted path), but there is no
// reason to accept a number the browser can set when the server can read
// the user's real cart directly. Now it does, and also returns the full
// handling+VAT breakdown through the same pricingService the cart and order
// creation use, so the checkout preview never re-derives it client-side.
async function validateCoupon(req, res, next) {
  try {
    const { code } = req.body;
    const items = await cartService.getCart(req.user.id);
    const lineItems = items.map((item) => ({ price: item.product.price, quantity: item.quantity }));
    const { itemsSubtotal } = pricingService.calculateOrderTotals(lineItems);

    const { coupon, discountAmount } = await couponService.findValidCoupon(code, itemsSubtotal);
    const totals = pricingService.calculateOrderTotals(lineItems, { discountAmount });

    res.json({ valid: true, discountAmount, coupon: couponPresenter.toView(coupon), totals });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAllAdmin, getById, create, update, remove, validateCoupon };
