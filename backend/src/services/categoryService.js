const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');
const { categorySlug } = require('../utils/slug');

async function listActive() {
  return prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}

async function listAll() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

async function create({ name, description, isActive }) {
  if (!name) {
    throw new HttpError(400, 'Category name is required');
  }
  return prisma.category.create({
    data: { name, slug: categorySlug(name), description: description || '', isActive: isActive ?? true },
  });
}

async function update(id, { name, description, isActive }) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Category not found');
  }

  const data = {};
  if (name !== undefined) {
    data.name = name;
    data.slug = categorySlug(name);
  }
  if (description !== undefined) data.description = description;
  if (isActive !== undefined) data.isActive = isActive;

  return prisma.category.update({ where: { id }, data });
}

async function remove(id) {
  const inUse = await prisma.product.findFirst({ where: { categoryId: id } });
  if (inUse) {
    throw new HttpError(400, 'Cannot delete a category that has products');
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Category not found');
  }

  await prisma.category.delete({ where: { id } });
}

module.exports = { listActive, listAll, create, update, remove };
