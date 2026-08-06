const slugify = require('slugify');

function categorySlug(name) {
  return slugify(name, { lower: true, strict: true });
}

function brandSlug(name) {
  return slugify(name, { lower: true, strict: true });
}

// Product slugs get a base36 timestamp suffix so duplicate product names
// (unlike category names, which are unique) never collide.
function productSlug(name) {
  return `${slugify(name, { lower: true, strict: true })}-${Date.now().toString(36)}`;
}

module.exports = { categorySlug, productSlug, brandSlug };
