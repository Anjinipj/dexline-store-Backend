const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

// Tests run against the real dev database (no separate test-DB/CI
// infrastructure exists in this project yet) — every helper here creates
// clearly-tagged rows and every test file cleans up what it created.
async function createTestUser(overrides = {}) {
  const email = overrides.email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const phone = overrides.phone || `+9715${Math.floor(10000000 + Math.random() * 89999999)}`;
  return prisma.user.create({
    data: {
      name: overrides.name || 'Test User',
      email,
      passwordHash: await bcrypt.hash(overrides.password || 'password123', 4),
      phone,
      status: overrides.status || 'pending_verification',
      role: overrides.role || 'customer',
    },
  });
}

async function createTestAdmin(overrides = {}) {
  return createTestUser({ status: 'active', ...overrides, role: 'admin' });
}

async function deleteTestUser(userId) {
  if (!userId) return;
  // Order.customer is onDelete: Restrict, so a user with orders would
  // otherwise fail this delete — silently, since it's caught below — and
  // leak the user/order/notification rows into the dev DB on every test
  // run. Deleting their orders first cascades away OrderItem,
  // OrderStatusHistory, OrderNotification, and Invoice rows at the DB level.
  await prisma.order.deleteMany({ where: { customerId: userId } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.phoneVerification.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

async function deleteTestUserByEmail(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) await deleteTestUser(user.id);
}

// Product requires a real Category and Brand (both onDelete: Restrict), so
// pricing/order tests need their own throwaway rows — tagged with a unique
// per-run suffix so parallel test files never collide on the unique
// name/slug constraints.
async function createTestProduct(overrides = {}) {
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const category = await prisma.category.create({
    data: { name: `Test Category ${tag}`, slug: `test-category-${tag}` },
  });
  const brand = await prisma.brand.create({
    data: { name: `Test Brand ${tag}`, slug: `test-brand-${tag}` },
  });
  const product = await prisma.product.create({
    data: {
      name: overrides.name || `Test Product ${tag}`,
      slug: `test-product-${tag}`,
      categoryId: category.id,
      brandId: brand.id,
      price: overrides.price ?? 100,
      stock: overrides.stock ?? 100,
      isActive: true,
    },
  });
  return { product, category, brand };
}

async function deleteTestProduct({ product, category, brand }) {
  if (product) await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
  if (category) await prisma.category.delete({ where: { id: category.id } }).catch(() => {});
  if (brand) await prisma.brand.delete({ where: { id: brand.id } }).catch(() => {});
}

module.exports = {
  createTestUser,
  createTestAdmin,
  deleteTestUser,
  deleteTestUserByEmail,
  createTestProduct,
  deleteTestProduct,
};
