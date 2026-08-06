const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');

const PRODUCT_SELECT = { id: true, name: true, slug: true, price: true, stock: true, images: true, isActive: true };

async function getOrCreateCart(userId) {
  return prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

async function getPopulatedItems(userId) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: { select: PRODUCT_SELECT } } } },
  });

  if (!cart) return [];

  // Drop items whose product was deactivated since being added (a hard-deleted
  // product's cart row is removed outright via the Product->CartItem cascade).
  return cart.items.filter((item) => item.product && item.product.isActive);
}

async function getCart(userId) {
  return getPopulatedItems(userId);
}

async function addItem(userId, { productId, quantity = 1 }) {
  if (!productId) {
    throw new HttpError(400, 'productId is required');
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive) {
    throw new HttpError(404, 'Product not found');
  }

  const cart = await getOrCreateCart(userId);
  const qty = Number(quantity);

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + qty },
    });
  } else {
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity: qty } });
  }

  return getPopulatedItems(userId);
}

async function updateItem(userId, productId, { quantity }) {
  if (!quantity || quantity < 1) {
    throw new HttpError(400, 'quantity must be at least 1');
  }

  const cart = await getOrCreateCart(userId);
  const item = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });
  if (!item) {
    throw new HttpError(404, 'Item not in cart');
  }

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: Number(quantity) } });
  return getPopulatedItems(userId);
}

async function removeItem(userId, productId) {
  const cart = await getOrCreateCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  return getPopulatedItems(userId);
}

async function clearCart(userId) {
  const cart = await getOrCreateCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
