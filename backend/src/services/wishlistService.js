const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');

const PRODUCT_SELECT = { id: true, name: true, slug: true, price: true, stock: true, images: true, isActive: true };

async function getItems(userId) {
  const items = await prisma.wishlistItem.findMany({
    where: { userId },
    include: { product: { select: PRODUCT_SELECT } },
    orderBy: { createdAt: 'desc' },
  });

  // Drop items whose product was deactivated since being added.
  return items.filter((item) => item.product && item.product.isActive);
}

async function addItem(userId, { productId }) {
  if (!productId) {
    throw new HttpError(400, 'productId is required');
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive) {
    throw new HttpError(404, 'Product not found');
  }

  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  });

  return getItems(userId);
}

async function removeItem(userId, productId) {
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
  return getItems(userId);
}

module.exports = { getItems, addItem, removeItem };
