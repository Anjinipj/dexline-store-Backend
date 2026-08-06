const { mapId, toNumber } = require('./shared');

function toView(coupon) {
  if (!coupon) return coupon;
  return mapId({
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: toNumber(coupon.value),
    isActive: coupon.isActive,
    expiresAt: coupon.expiresAt,
    minOrderAmount: toNumber(coupon.minOrderAmount),
  });
}

function toListView(coupons) {
  return coupons.map(toView);
}

module.exports = { toView, toListView };
