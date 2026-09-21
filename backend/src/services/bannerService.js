const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');

const ORDER_BY = [{ order: 'asc' }, { createdAt: 'asc' }];

async function listActive() {
  return prisma.banner.findMany({ where: { isActive: true }, orderBy: ORDER_BY });
}

async function listAll() {
  return prisma.banner.findMany({ orderBy: ORDER_BY });
}

async function getById(id) {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) {
    throw new HttpError(404, 'Banner not found');
  }
  return banner;
}

const MAX_IMAGES = 5;

async function create({ images, badge, title, description, buttonText, linkHref, order, isActive }) {
  if (!Array.isArray(images) || images.length === 0 || !title) {
    throw new HttpError(400, 'At least one image and a title are required');
  }

  return prisma.banner.create({
    data: {
      images: images.slice(0, MAX_IMAGES),
      badge: badge || '',
      title,
      description: description || '',
      buttonText: buttonText || 'Shop Now',
      linkHref: linkHref || '/#catalog',
      order: order ?? 0,
      isActive: isActive ?? true,
    },
  });
}

async function update(id, body) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Banner not found');
  }

  const data = {};
  const fields = ['badge', 'title', 'description', 'buttonText', 'linkHref', 'order', 'isActive'];
  fields.forEach((field) => {
    if (body[field] !== undefined) data[field] = body[field];
  });
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.length === 0) {
      throw new HttpError(400, 'At least one image is required');
    }
    data.images = body.images.slice(0, MAX_IMAGES);
  }

  return prisma.banner.update({ where: { id }, data });
}

async function remove(id) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Banner not found');
  }
  await prisma.banner.delete({ where: { id } });
}

// Persists a complete new display order. The client sends every banner id in
// the sequence it wants; each banner's `order` becomes its 0-based index, all
// inside one transaction so a failure can never leave half the list
// renumbered. Renumbering (rather than swapping two values) also repairs
// lists where several banners share the same `order`, which would make a
// simple swap a silent no-op.
async function reorder(ids) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
    throw new HttpError(400, 'ids must be a non-empty array of banner ids');
  }
  if (new Set(ids).size !== ids.length) {
    throw new HttpError(400, 'ids must not contain duplicates');
  }

  const existing = await prisma.banner.findMany({ select: { id: true } });
  const known = new Set(existing.map((b) => b.id));
  if (known.size !== ids.length || ids.some((id) => !known.has(id))) {
    // Someone added/removed a banner since this list was loaded.
    throw new HttpError(409, 'The banner list has changed. Refresh the page and try again.');
  }

  await prisma.$transaction(ids.map((id, index) => prisma.banner.update({ where: { id }, data: { order: index } })));
  return listAll();
}

module.exports = { listActive, listAll, getById, create, update, remove, reorder };
