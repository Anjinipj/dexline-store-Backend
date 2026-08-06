const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');
const { productSlug } = require('../utils/slug');

const CATEGORY_SELECT = { id: true, name: true, slug: true };

function buildFilter({ category, search, isActive }) {
  const filter = {};
  if (isActive !== undefined) filter.isActive = isActive;
  if (category) filter.categoryId = category;
  if (search) {
    filter.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  return filter;
}

function clampPage(page) {
  return Math.max(parseInt(page, 10) || 1, 1);
}

function clampLimit(limit, fallback, max) {
  return Math.min(Math.max(parseInt(limit, 10) || fallback, 1), max);
}

async function list({ category, search, page = 1, limit = 12 }) {
  const filter = buildFilter({ category, search, isActive: true });
  const pageNum = clampPage(page);
  const limitNum = clampLimit(limit, 12, 50);

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: filter,
      include: { category: { select: CATEGORY_SELECT } },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.product.count({ where: filter }),
  ]);

  return { products, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } };
}

async function listAllAdmin({ category, search, page = 1, limit = 20 }) {
  const filter = buildFilter({ category, search });
  const pageNum = clampPage(page);
  const limitNum = clampLimit(limit, 20, 100);

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: filter,
      include: { category: { select: CATEGORY_SELECT } },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.product.count({ where: filter }),
  ]);

  return { products, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } };
}

async function getBySlug(slug) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: { category: { select: CATEGORY_SELECT } },
  });
  if (!product) {
    throw new HttpError(404, 'Product not found');
  }
  return product;
}

async function getById(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: { select: CATEGORY_SELECT } },
  });
  if (!product) {
    throw new HttpError(404, 'Product not found');
  }
  return product;
}

async function create({ name, category, price, compareAtPrice, images, description, stock, isActive, isFeatured }) {
  if (!name || !category || price === undefined) {
    throw new HttpError(400, 'Name, category and price are required');
  }

  const product = await prisma.product.create({
    data: {
      name,
      slug: productSlug(name),
      categoryId: category,
      price,
      compareAtPrice: compareAtPrice ?? null,
      images: images || [],
      description: description || '',
      stock: stock ?? 0,
      isActive: isActive ?? true,
      isFeatured: isFeatured ?? false,
    },
    include: { category: { select: CATEGORY_SELECT } },
  });

  return product;
}

async function update(id, body) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Product not found');
  }

  const data = {};
  if (body.name !== undefined) {
    data.name = body.name;
    data.slug = productSlug(body.name);
  }
  if (body.category !== undefined) data.categoryId = body.category;
  if (body.price !== undefined) data.price = body.price;
  if (body.compareAtPrice !== undefined) data.compareAtPrice = body.compareAtPrice;
  if (body.images !== undefined) data.images = body.images;
  if (body.description !== undefined) data.description = body.description;
  if (body.stock !== undefined) data.stock = body.stock;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured;

  return prisma.product.update({
    where: { id },
    data,
    include: { category: { select: CATEGORY_SELECT } },
  });
}

async function remove(id) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Product not found');
  }
  await prisma.product.delete({ where: { id } });
}

module.exports = { list, listAllAdmin, getBySlug, getById, create, update, remove };
