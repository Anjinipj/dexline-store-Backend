const { mapId } = require('./shared');

function toView(category) {
  if (!category) return category;
  return mapId({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    isActive: category.isActive,
    parentId: category.parentId,
    parent: category.parent ? mapId({ id: category.parent.id, name: category.parent.name, slug: category.parent.slug }) : null,
  });
}

function toListView(categories) {
  return categories.map(toView);
}

module.exports = { toView, toListView };
