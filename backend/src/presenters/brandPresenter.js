const { mapId } = require('./shared');

function toView(brand) {
  if (!brand) return brand;
  return mapId({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    description: brand.description,
    isActive: brand.isActive,
    // Only present on the admin list, where it is counted for real.
    ...(brand._count ? { productCount: brand._count.products } : {}),
  });
}

function toListView(brands) {
  return brands.map(toView);
}

module.exports = { toView, toListView };
