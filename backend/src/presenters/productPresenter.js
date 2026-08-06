const { mapId, toNumber } = require('./shared');

function toView(product) {
  if (!product) return product;
  return mapId({
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category
      ? mapId({ id: product.category.id, name: product.category.name, slug: product.category.slug })
      : product.categoryId,
    price: toNumber(product.price),
    compareAtPrice: toNumber(product.compareAtPrice),
    images: product.images,
    description: product.description,
    stock: product.stock,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    inStock: product.stock > 0,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  });
}

function toListView(products) {
  return products.map(toView);
}

module.exports = { toView, toListView };
