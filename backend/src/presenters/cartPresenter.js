const { mapId, toNumber } = require('./shared');
const pricingService = require('../services/pricingService');

// Every cart response carries the current handling+VAT breakdown (no
// discount — that's only known once a coupon is applied at checkout), so
// the cart/checkout UI never has to recompute it: add/update/remove all
// return through this same presenter, so totals stay live on every change.
function toView(items) {
  const totals = pricingService.calculateOrderTotals(
    items.map((item) => ({ price: item.product.price, quantity: item.quantity }))
  );

  return {
    items: items.map((item) => ({
      product: mapId({
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        price: toNumber(item.product.price),
        stock: item.product.stock,
        images: item.product.images,
      }),
      quantity: item.quantity,
    })),
    totals,
  };
}

module.exports = { toView };
