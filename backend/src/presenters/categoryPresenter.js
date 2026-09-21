const { mapId } = require('./shared');

function toView(category) {
  if (!category) return category;
  return mapId({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.imageUrl,
    isActive: category.isActive,
    parentId: category.parentId,
    // Only present on the admin list, where they are counted for real.
    ...(category._count ? { productCount: category._count.products, childCount: category._count.children } : {}),
    parent: category.parent ? mapId({ id: category.parent.id, name: category.parent.name, slug: category.parent.slug }) : null,
  });
}

function toListView(categories) {
  return categories.map(toView);
}

module.exports = { toView, toListView };
