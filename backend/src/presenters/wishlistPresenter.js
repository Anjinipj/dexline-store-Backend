const { mapId, toNumber } = require('./shared');

function toView(items) {
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
      addedAt: item.createdAt,
    })),
  };
}

module.exports = { toView };
