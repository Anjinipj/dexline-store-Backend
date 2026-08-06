const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');
const { brandSlug } = require('../utils/slug');

function clampPage(page) {
  return Math.max(parseInt(page, 10) || 1, 1);
}

function clampLimit(limit, fallback, max) {
  return Math.min(Math.max(parseInt(limit, 10) || fallback, 1), max);
}

async function list({ search, page = 1, limit = 50 }) {
  const filter = { isActive: true };
  if (search) filter.name = { contains: search, mode: 'insensitive' };

  const pageNum = clampPage(page);
  const limitNum = clampLimit(limit, 50, 100);

  const [brands, total] = await Promise.all([
    prisma.brand.findMany({
      where: filter,
      orderBy: { name: 'asc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.brand.count({ where: filter }),
  ]);

  return { brands, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } };
}

async function listAllAdmin({ search, page = 1, limit = 100 }) {
  const filter = {};
  if (search) filter.name = { contains: search, mode: 'insensitive' };

  const pageNum = clampPage(page);
  const limitNum = clampLimit(limit, 100, 200);

  const [brands, total] = await Promise.all([
    prisma.brand.findMany({
      where: filter,
      orderBy: { name: 'asc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.brand.count({ where: filter }),
  ]);

  return { brands, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } };
}

async function getBySlug(slug) {
  const brand = await prisma.brand.findFirst({ where: { slug, isActive: true } });
  if (!brand) {
    throw new HttpError(404, 'Brand not found');
  }
  return brand;
}

async function getById(id) {
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) {
    throw new HttpError(404, 'Brand not found');
  }
  return brand;
}

async function create({ name, logoUrl, description, isActive }) {
  if (!name) {
    throw new HttpError(400, 'Brand name is required');
  }

  return prisma.brand.create({
    data: {
      name,
      slug: brandSlug(name),
      logoUrl: logoUrl || '',
      description: description || '',
      isActive: isActive ?? true,
    },
  });
}

async function update(id, body) {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Brand not found');
  }

  const data = {};
  if (body.name !== undefined) {
    data.name = body.name;
    data.slug = brandSlug(body.name);
  }
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
  if (body.description !== undefined) data.description = body.description;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  return prisma.brand.update({ where: { id }, data });
}

async function remove(id) {
  const inUse = await prisma.product.findFirst({ where: { brandId: id } });
  if (inUse) {
    throw new HttpError(400, 'Cannot delete a brand that has products');
  }

  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Brand not found');
  }

  await prisma.brand.delete({ where: { id } });
}

module.exports = { list, listAllAdmin, getBySlug, getById, create, update, remove };
