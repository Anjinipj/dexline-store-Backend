const pricingConfig = require('../config/pricing');

// Decimal-safe rounding to the nearest 0.01 AED (a fils). The rest of this
// codebase already stores currency as JS numbers backed by Prisma
// Decimal(10,2) columns (see orderService.js, whatsapp.js) rather than a
// decimal library, so this keeps the same convention while guarding against
// binary floating-point drift (e.g. 1.005 * 100 landing on 100.49999...).
function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// The single source of truth for order totals — used by the cart totals
// preview, the coupon-validate preview, and orderService.createOrder (the
// only call site that actually persists an order). Never trusts a
// client-supplied total; every caller passes real product prices/quantities
// looked up from the database.
//
// lineItems: [{ price, quantity }] — price may be a number, string, or
// Prisma Decimal (Number() handles all three, matching existing call sites).
//
// Formula (VAT-exclusive prices — see config/pricing.js):
//   itemsSubtotal = sum(price * quantity)
//   handlingAmount = AED 30 once per order, 0 for an empty cart
//   taxableAmount = itemsSubtotal - discountAmount + handlingAmount
//   vatAmount = taxableAmount * vatRate, rounded to the nearest fils
//   totalAmount = taxableAmount + vatAmount
function calculateOrderTotals(lineItems, { discountAmount = 0 } = {}) {
  const items = lineItems || [];
  const hasItems = items.length > 0;

  const itemsSubtotal = roundCurrency(
    items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
  );

  // Never let a discount (or floating-point overshoot) push the subtotal
  // negative — findValidCoupon already caps FIXED coupons at the subtotal,
  // this is a second, cheap guard at the shared boundary.
  const safeDiscount = roundCurrency(Math.min(Math.max(discountAmount, 0), itemsSubtotal));

  const handlingAmount = hasItems ? pricingConfig.handlingChargeAed : 0;
  const taxableAmount = roundCurrency(Math.max(itemsSubtotal - safeDiscount + handlingAmount, 0));
  const vatRate = pricingConfig.vatRate;
  const vatAmount = roundCurrency(taxableAmount * vatRate);
  const totalAmount = roundCurrency(taxableAmount + vatAmount);

  return {
    itemsSubtotal,
    discountAmount: safeDiscount,
    handlingAmount,
    taxableAmount,
    vatRate,
    vatAmount,
    totalAmount,
  };
}

module.exports = { calculateOrderTotals, roundCurrency };
