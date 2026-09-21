const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const generateToken = require('../src/utils/generateToken');
const { createTestUser, deleteTestUser, createTestProduct, deleteTestProduct } = require('./helpers');

describe('Order pricing (handling charge + VAT)', () => {
  afterAll(async () => prisma.$disconnect());

  test('an empty cart returns all-zero totals — no handling charge applied', async () => {
    const user = await createTestUser();
    try {
      const token = generateToken(user);
      const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(0);
      expect(res.body.cart.totals).toEqual({
        itemsSubtotal: 0,
        discountAmount: 0,
        handlingAmount: 0,
        taxableAmount: 0,
        vatRate: 0.05,
        vatAmount: 0,
        totalAmount: 0,
      });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('the cart totals recompute on add, quantity change, and removal', async () => {
    const user = await createTestUser();
    const fixture = await createTestProduct({ price: 500 });
    try {
      const token = generateToken(user);
      const auth = { Authorization: `Bearer ${token}` };

      const afterAdd = await request(app)
        .post('/api/cart/items')
        .set(auth)
        .send({ productId: fixture.product.id, quantity: 1 });
      // subtotal 500 + handling 30 = 530 taxable, vat 26.5, total 556.5
      expect(afterAdd.body.cart.totals.itemsSubtotal).toBe(500);
      expect(afterAdd.body.cart.totals.totalAmount).toBe(556.5);

      const afterQtyChange = await request(app)
        .put(`/api/cart/items/${fixture.product.id}`)
        .set(auth)
        .send({ quantity: 2 });
      // subtotal 1000 + handling 30 = 1030 taxable, vat 51.5, total 1081.5
      expect(afterQtyChange.body.cart.totals.itemsSubtotal).toBe(1000);
      expect(afterQtyChange.body.cart.totals.totalAmount).toBe(1081.5);

      const afterRemove = await request(app)
        .delete(`/api/cart/items/${fixture.product.id}`)
        .set(auth);
      expect(afterRemove.body.cart.items).toHaveLength(0);
      expect(afterRemove.body.cart.totals.totalAmount).toBe(0);
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('placing an order snapshots the full backend-calculated breakdown, matching the AED 1,000 example', async () => {
    const user = await createTestUser({ phone: `+9715${Math.floor(10000000 + Math.random() * 89999999)}` });
    const fixture = await createTestProduct({ price: 1000, stock: 5 });
    try {
      const token = generateToken(user);
      const auth = { Authorization: `Bearer ${token}` };

      await request(app).post('/api/cart/items').set(auth).send({ productId: fixture.product.id, quantity: 1 });

      const res = await request(app).post('/api/orders').set(auth).send({ phone: user.phone });

      expect(res.status).toBe(201);
      const { order } = res.body;
      expect(order.subtotalAmount).toBe(1000);
      expect(order.discountAmount).toBe(0);
      expect(order.handlingAmount).toBe(30);
      expect(order.taxableAmount).toBe(1030);
      expect(order.vatRate).toBe(0.05);
      expect(order.taxAmount).toBe(51.5);
      expect(order.totalAmount).toBe(1081.5);

      // The saved row (not just the response) carries the same numbers, and
      // the WhatsApp link — the only "payment request" this app sends — is
      // built from that same saved order, not recomputed.
      const saved = await prisma.order.findUnique({ where: { id: order._id } });
      expect(Number(saved.totalAmount)).toBe(1081.5);
      expect(res.body.whatsappLink).toContain(encodeURIComponent('Total: AED 1081.50'));
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('a discount is applied before handling and VAT, and stock/coupon interactions are unaffected', async () => {
    const user = await createTestUser({ phone: `+9715${Math.floor(10000000 + Math.random() * 89999999)}` });
    const fixture = await createTestProduct({ price: 1000, stock: 5 });
    const coupon = await prisma.coupon.create({
      data: { code: `PRICINGTEST${Date.now()}`, type: 'FIXED', value: 100, isActive: true },
    });
    try {
      const token = generateToken(user);
      const auth = { Authorization: `Bearer ${token}` };
      await request(app).post('/api/cart/items').set(auth).send({ productId: fixture.product.id, quantity: 1 });

      const res = await request(app)
        .post('/api/orders')
        .set(auth)
        .send({ phone: user.phone, couponCode: coupon.code });

      expect(res.status).toBe(201);
      const { order } = res.body;
      // subtotal 1000, discount 100 -> taxable = 900 + 30 = 930, vat 46.5, total 976.5
      expect(order.discountAmount).toBe(100);
      expect(order.taxableAmount).toBe(930);
      expect(order.taxAmount).toBe(46.5);
      expect(order.totalAmount).toBe(976.5);
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {});
    }
  });

  test('decimal-priced items round VAT to the nearest fils with no drift', async () => {
    const user = await createTestUser({ phone: `+9715${Math.floor(10000000 + Math.random() * 89999999)}` });
    const fixture = await createTestProduct({ price: 10.15, stock: 5 });
    try {
      const token = generateToken(user);
      const auth = { Authorization: `Bearer ${token}` };
      await request(app).post('/api/cart/items').set(auth).send({ productId: fixture.product.id, quantity: 3 });

      const res = await request(app).post('/api/orders').set(auth).send({ phone: user.phone });

      expect(res.status).toBe(201);
      const { order } = res.body;
      expect(order.subtotalAmount).toBe(30.45);
      // taxable = 30.45 + 30 = 60.45, vat = 3.0225 -> rounds to 3.02
      expect(order.taxableAmount).toBe(60.45);
      expect(order.taxAmount).toBe(3.02);
      expect(order.totalAmount).toBe(63.47);
      expect(Number.isInteger(order.totalAmount * 100)).toBe(true);
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('a pre-existing order created before this migration keeps its original amounts untouched', async () => {
    const user = await createTestUser();
    try {
      // Simulates a historical row: handlingAmount/taxableAmount/vatRate all
      // default to 0 (the migration's column defaults), exactly as a
      // pre-migration order would read after the columns were added.
      const legacyOrder = await prisma.order.create({
        data: {
          orderNumber: `LEGACY-${Date.now()}`,
          customerId: user.id,
          customerName: user.name,
          customerPhone: user.phone,
          subtotalAmount: 250,
          discountAmount: 0,
          totalAmount: 250,
          items: { create: [{ name: 'Legacy Item', price: 250, quantity: 1 }] },
        },
      });

      const res = await request(app)
        .get(`/api/orders/mine/${legacyOrder.id}`)
        .set('Authorization', `Bearer ${generateToken(user)}`);

      expect(res.status).toBe(200);
      // Nothing recalculates a stored order on read — it comes back exactly
      // as it was saved, handling charge and VAT included.
      expect(res.body.order.subtotalAmount).toBe(250);
      expect(res.body.order.handlingAmount).toBe(0);
      expect(res.body.order.taxAmount).toBe(0);
      expect(res.body.order.totalAmount).toBe(250);
    } finally {
      await prisma.order.deleteMany({ where: { customerId: user.id } });
      await deleteTestUser(user.id);
    }
  });
});
