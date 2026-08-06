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

async function create({ image, badge, title, description, buttonText, linkHref, order, isActive }) {
  if (!image || !title) {
    throw new HttpError(400, 'Image and title are required');
  }

  return prisma.banner.create({
    data: {
      image,
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
  const fields = ['image', 'badge', 'title', 'description', 'buttonText', 'linkHref', 'order', 'isActive'];
  fields.forEach((field) => {
    if (body[field] !== undefined) data[field] = body[field];
  });

  return prisma.banner.update({ where: { id }, data });
}

async function remove(id) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Banner not found');
  }
  await prisma.banner.delete({ where: { id } });
}

module.exports = { listActive, listAll, getById, create, update, remove };
