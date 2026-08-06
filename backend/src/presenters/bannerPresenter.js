const { mapId } = require('./shared');

function toView(banner) {
  if (!banner) return banner;
  return mapId({
    id: banner.id,
    image: banner.image,
    badge: banner.badge,
    title: banner.title,
    description: banner.description,
    buttonText: banner.buttonText,
    linkHref: banner.linkHref,
    order: banner.order,
    isActive: banner.isActive,
  });
}

function toListView(banners) {
  return banners.map(toView);
}

module.exports = { toView, toListView };
