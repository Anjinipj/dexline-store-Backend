const couponService = require('../services/couponService');
const couponPresenter = require('../presenters/couponPresenter');

async function listAllAdmin(req, res, next) {
  try {
    const coupons = await couponService.listAllAdmin();
    res.json({ coupons: couponPresenter.toListView(coupons) });
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

async function validateCoupon(req, res, next) {
  try {
    const { code, subtotal } = req.body;
    const { coupon, discountAmount } = await couponService.findValidCoupon(code, Number(subtotal) || 0);
    res.json({ valid: true, discountAmount, coupon: couponPresenter.toView(coupon) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAllAdmin, getById, create, update, remove, validateCoupon };
