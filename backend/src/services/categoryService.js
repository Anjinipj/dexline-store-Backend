const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');
const { categorySlug } = require('../utils/slug');

const PARENT_SELECT = { id: true, name: true, slug: true };

async function listActive() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: { parent: { select: PARENT_SELECT } },
  });
}

async function listAll() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { parent: { select: PARENT_SELECT } },
  });
}

// Walks up the parent chain starting at startId, throwing if targetId is ever
// encountered — used to reject a category update that would make it a
// descendant of its own descendant (a multi-level cycle).
async function assertNoCycle(targetId, startParentId) {
  let currentId = startParentId;
  const seen = new Set();
  while (currentId) {
    if (currentId === targetId) {
      throw new HttpError(400, 'Cannot make a category a descendant of itself');
    }
    if (seen.has(currentId)) break; // defensive: pre-existing cycle, stop rather than loop forever
    seen.add(currentId);
    const parent = await prisma.category.findUnique({ where: { id: currentId }, select: { parentId: true } });
    currentId = parent?.parentId ?? null;
  }
}

async function create({ name, description, imageUrl, isActive, parentId }) {
  if (!name) {
    throw new HttpError(400, 'Category name is required');
  }

  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new HttpError(400, 'Parent category not found');
    }
  }

  return prisma.category.create({
    data: {
      name,
      slug: categorySlug(name),
      description: description || '',
      imageUrl: imageUrl || '',
      isActive: isActive ?? true,
      parentId: parentId || null,
    },
    include: { parent: { select: PARENT_SELECT } },
  });
}

async function update(id, { name, description, imageUrl, isActive, parentId }) {
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
  if (imageUrl !== undefined) data.imageUrl = imageUrl;
  if (isActive !== undefined) data.isActive = isActive;

  if (parentId !== undefined) {
    if (parentId === null || parentId === '') {
      data.parentId = null;
    } else {
      if (parentId === id) {
        throw new HttpError(400, 'A category cannot be its own parent');
      }
      const parent = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parent) {
        throw new HttpError(400, 'Parent category not found');
      }
      await assertNoCycle(id, parentId);
      data.parentId = parentId;
    }
  }

  return prisma.category.update({
    where: { id },
    data,
    include: { parent: { select: PARENT_SELECT } },
  });
}

async function remove(id) {
  const inUse = await prisma.product.findFirst({ where: { categoryId: id } });
  if (inUse) {
    throw new HttpError(400, 'Cannot delete a category that has products');
  }

  const hasChildren = await prisma.category.findFirst({ where: { parentId: id } });
  if (hasChildren) {
    throw new HttpError(400, 'Cannot delete a category that has subcategories');
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Category not found');
  }

  await prisma.category.delete({ where: { id } });
}

module.exports = { listActive, listAll, create, update, remove };
