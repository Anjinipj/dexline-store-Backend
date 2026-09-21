const { mapId, toNumber } = require('./shared');

// Same rule checkout applies: expired wins over the isActive flag.
function couponStatus(coupon) {
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return 'expired';
  return coupon.isActive ? 'active' : 'inactive';
}

function toView(coupon) {
  if (!coupon) return coupon;
  return mapId({
    status: couponStatus(coupon),
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
