jest.mock('../src/utils/mailer', () => ({ sendMail: jest.fn().mockResolvedValue({ devMode: false, messageId: 'mock' }) }));

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const generateToken = require('../src/utils/generateToken');
const { businessDayRange } = require('../src/utils/timezone');
const { createTestUser, createTestAdmin, deleteTestUser, createTestProduct, deleteTestProduct } = require('./helpers');

const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Admin routes are protected server-side', () => {
  let customer;
  let customerAuth;

  beforeAll(async () => {
    customer = await createTestUser({ status: 'active' });
    customerAuth = { Authorization: `Bearer ${generateToken(customer)}` };
  });

  afterAll(async () => {
    await deleteTestUser(customer.id);
  });

  const adminGets = [
    '/api/admin/dashboard',
    '/api/products/admin/all',
    '/api/orders/admin/all',
    '/api/brands/admin/all',
    '/api/coupons/admin/all',
    '/api/banners/admin/all',
    '/api/categories/all',
    '/api/reports/sales',
    '/api/reports/inventory',
  ];

  test.each(adminGets)('%s rejects a request with no token (401)', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  test.each(adminGets)('%s rejects a signed-in customer (403)', async (path) => {
    const res = await request(app).get(path).set(customerAuth);
    expect(res.status).toBe(403);
  });

  test('admin write actions reject a signed-in customer (403)', async () => {
    const calls = [
      request(app).put('/api/banners/reorder').set(customerAuth).send({ ids: ['x'] }),
      request(app).post('/api/coupons').set(customerAuth).send({ code: 'NOPE', type: 'FIXED', value: 1 }),
      request(app).delete('/api/products/some-id').set(customerAuth),
      request(app).post('/api/categories').set(customerAuth).send({ name: 'Nope' }),
      request(app).put('/api/orders/admin/some-id/status').set(customerAuth).send({ status: 'Confirmed' }),
    ];
    const results = await Promise.all(calls);
    results.forEach((res) => expect(res.status).toBe(403));
  });
});

describe('businessDayRange', () => {
  test('covers whole calendar days in the business timezone', () => {
    const range = businessDayRange({ from: '2026-09-21', to: '2026-09-21' }, 'Asia/Dubai');
    // Dubai is UTC+4 all year: 21 Sep 00:00 Dubai is 20 Sep 20:00 UTC.
    expect(range.gte.toISOString()).toBe('2026-09-20T20:00:00.000Z');
    expect(range.lte.toISOString()).toBe('2026-09-21T19:59:59.999Z');
  });

  test('returns null with no bounds and rejects bad or reversed dates', () => {
    expect(businessDayRange({}, 'Asia/Dubai')).toBeNull();
    expect(() => businessDayRange({ from: '21/09/2026' }, 'Asia/Dubai')).toThrow(/YYYY-MM-DD/);
    expect(() => businessDayRange({ from: '2026-02-30' }, 'Asia/Dubai')).toThrow(/real calendar date/);
    expect(() => businessDayRange({ from: '2026-09-22', to: '2026-09-21' }, 'Asia/Dubai')).toThrow(/after/);
  });
});

describe('Admin product list filters run on the whole dataset', () => {
  let admin;
  let adminAuth;
  let category;
  let brand;
  const productIds = [];

  beforeAll(async () => {
    admin = await createTestAdmin();
    adminAuth = { Authorization: `Bearer ${generateToken(admin)}` };
    category = await prisma.category.create({ data: { name: `Admin List Cat ${tag}`, slug: `admin-list-cat-${tag}` } });
    brand = await prisma.brand.create({ data: { name: `Admin List Brand ${tag}`, slug: `admin-list-brand-${tag}` } });

    const rows = [
      { name: `Alpha ${tag}`, price: 300, stock: 0, isActive: true },
      { name: `Bravo ${tag}`, price: 100, stock: 3, isActive: true },
      { name: `Charlie ${tag}`, price: 200, stock: 50, isActive: false },
      { name: `Delta ${tag}`, price: 400, stock: 5, isActive: true },
      { name: `Echo ${tag}`, price: 500, stock: 80, isActive: true },
    ];
    for (const row of rows) {
      const p = await prisma.product.create({
        data: { ...row, slug: `admin-list-${row.name.toLowerCase().replace(/\s+/g, '-')}`, categoryId: category.id, brandId: brand.id },
      });
      productIds.push(p.id);
    }
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.category.delete({ where: { id: category.id } }).catch(() => {});
    await prisma.brand.delete({ where: { id: brand.id } }).catch(() => {});
    await deleteTestUser(admin.id);
  });

  const list = (query) =>
    request(app).get(`/api/products/admin/all?category=${category.id}&${query}`).set(adminAuth);

  test('status filter counts every matching product, not just one page', async () => {
    const active = await list('status=active&limit=2');
    expect(active.body.pagination.total).toBe(4);
    expect(active.body.products).toHaveLength(2);
    expect(active.body.pagination.pages).toBe(2);

    const inactive = await list('status=inactive');
    expect(inactive.body.products.map((p) => p.name)).toEqual([`Charlie ${tag}`]);
  });

  test('low-stock filter uses the shared threshold (5, includes out of stock)', async () => {
    const low = await list('stock=low&sort=stock&dir=asc');
    expect(low.body.products.map((p) => p.stock)).toEqual([0, 3, 5]);

    const out = await list('stock=out');
    expect(out.body.products.map((p) => p.name)).toEqual([`Alpha ${tag}`]);
  });

  test('sorts the full result set, then paginates it', async () => {
    const page1 = await list('sort=price&dir=desc&limit=2&page=1');
    const page2 = await list('sort=price&dir=desc&limit=2&page=2');
    expect(page1.body.products.map((p) => p.price)).toEqual([500, 400]);
    expect(page2.body.products.map((p) => p.price)).toEqual([300, 200]);
  });

  test('re-saving a product with an unchanged name keeps its public URL slug', async () => {
    const before = await prisma.product.findUnique({ where: { id: productIds[0] } });
    const res = await request(app)
      .put(`/api/products/${productIds[0]}`)
      .set(adminAuth)
      .send({ name: before.name, price: 301 });
    expect(res.status).toBe(200);
    expect(res.body.product.slug).toBe(before.slug);
    expect(res.body.product.price).toBe(301);
    await prisma.product.update({ where: { id: productIds[0] }, data: { price: 300 } });
  });

  test('an unrecognised sort field falls back instead of erroring', async () => {
    const res = await list('sort=passwordHash');
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(5);
  });
});

describe('Admin brand and category lists expose real counts', () => {
  let admin;
  let adminAuth;
  let fixture;

  beforeAll(async () => {
    admin = await createTestAdmin();
    adminAuth = { Authorization: `Bearer ${generateToken(admin)}` };
    fixture = await createTestProduct();
  });

  afterAll(async () => {
    await deleteTestProduct(fixture);
    await deleteTestUser(admin.id);
  });

  test('brand list returns productCount and supports a status filter', async () => {
    const res = await request(app)
      .get(`/api/brands/admin/all?search=${encodeURIComponent(fixture.brand.name)}&status=active`)
      .set(adminAuth);
    expect(res.status).toBe(200);
    const row = res.body.brands.find((b) => b._id === fixture.brand.id);
    expect(row.productCount).toBe(1);

    const inactive = await request(app)
      .get(`/api/brands/admin/all?search=${encodeURIComponent(fixture.brand.name)}&status=inactive`)
      .set(adminAuth);
    expect(inactive.body.brands).toHaveLength(0);
  });

  test('category list returns product and subcategory counts', async () => {
    const res = await request(app).get('/api/categories/all').set(adminAuth);
    const row = res.body.categories.find((c) => c._id === fixture.category.id);
    expect(row.productCount).toBe(1);
    expect(row.childCount).toBe(0);
  });

  test('a category with products still cannot be deleted', async () => {
    const res = await request(app).delete(`/api/categories/${fixture.category.id}`).set(adminAuth);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/has products/);
  });

  test('a brand with products still cannot be deleted', async () => {
    const res = await request(app).delete(`/api/brands/${fixture.brand.id}`).set(adminAuth);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/has products/);
  });
});

describe('Admin coupon list', () => {
  let admin;
  let adminAuth;
  const ids = [];
  const code = (suffix) => `ADM${suffix}${tag}`.toUpperCase().replace(/[^A-Z0-9]/g, '');

  beforeAll(async () => {
    admin = await createTestAdmin();
    adminAuth = { Authorization: `Bearer ${generateToken(admin)}` };
    const past = new Date(Date.now() - 86400000);
    const future = new Date(Date.now() + 30 * 86400000);
    const rows = [
      { code: code('LIVE'), isActive: true, expiresAt: future },
      { code: code('OFF'), isActive: false, expiresAt: null },
      { code: code('OLD'), isActive: true, expiresAt: past },
      { code: code('OLDOFF'), isActive: false, expiresAt: past },
    ];
    for (const row of rows) {
      const c = await prisma.coupon.create({ data: { ...row, type: 'FIXED', value: 10 } });
      ids.push(c.id);
    }
  });

  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { id: { in: ids } } });
    await deleteTestUser(admin.id);
  });

  const list = (status) =>
    request(app).get(`/api/coupons/admin/all?search=${tag.replace(/[^a-z0-9]/gi, '').toUpperCase()}&status=${status}`).set(adminAuth);

  test('distinguishes Active, Inactive and Expired using the checkout expiry rule', async () => {
    const active = await list('active');
    expect(active.body.coupons.map((c) => c.code)).toEqual([code('LIVE')]);
    expect(active.body.coupons[0].status).toBe('active');

    const inactive = await list('inactive');
    expect(inactive.body.coupons.map((c) => c.code)).toEqual([code('OFF')]);
    expect(inactive.body.coupons[0].status).toBe('inactive');

    // Expired wins over the isActive flag, exactly as findValidCoupon treats it.
    const expired = await list('expired');
    expect(expired.body.coupons.map((c) => c.code).sort()).toEqual([code('OLD'), code('OLDOFF')].sort());
    expired.body.coupons.forEach((c) => expect(c.status).toBe('expired'));
  });

  test('paginates and reports a total', async () => {
    const res = await request(app)
      .get(`/api/coupons/admin/all?search=${tag.replace(/[^a-z0-9]/gi, '').toUpperCase()}&limit=3&sort=code&dir=asc`)
      .set(adminAuth);
    expect(res.body.pagination.total).toBe(4);
    expect(res.body.coupons).toHaveLength(3);
  });
});

describe('Admin order list and detail', () => {
  let admin;
  let adminAuth;
  let customerA;
  let customerB;
  let fixture;
  let orderA;
  let orderB;

  async function placeOrder(user, quantity) {
    const auth = { Authorization: `Bearer ${generateToken(user)}` };
    await request(app).post('/api/cart/items').set(auth).send({ productId: fixture.product.id, quantity });
    const res = await request(app).post('/api/orders').set(auth).send({ phone: user.phone });
    return { auth, order: res.body.order };
  }

  beforeAll(async () => {
    admin = await createTestAdmin({ name: 'History Admin' });
    adminAuth = { Authorization: `Bearer ${generateToken(admin)}` };
    customerA = await createTestUser({ name: `Zulu Buyer ${tag}`, status: 'active' });
    customerB = await createTestUser({ name: `Yankee Buyer ${tag}`, status: 'active' });
    fixture = await createTestProduct({ price: 250 });
    orderA = await placeOrder(customerA, 1);
    orderB = await placeOrder(customerB, 3);
    // Pin placement times either side of Dubai midnight (UTC+4):
    // 23:30 on 20 Sep Dubai, and 00:30 on 21 Sep Dubai.
    await prisma.order.update({ where: { id: orderA.order._id }, data: { createdAt: new Date('2026-09-20T19:30:00Z') } });
    await prisma.order.update({ where: { id: orderB.order._id }, data: { createdAt: new Date('2026-09-20T20:30:00Z') } });
  });

  afterAll(async () => {
    await deleteTestUser(customerA.id);
    await deleteTestUser(customerB.id);
    await deleteTestProduct(fixture);
    await deleteTestUser(admin.id);
    await prisma.$disconnect();
  });

  const list = (query) => request(app).get(`/api/orders/admin/all?search=Buyer%20${tag}&${query}`).set(adminAuth);

  test('search finds orders by order number, customer name and email', async () => {
    const byNumber = await request(app).get(`/api/orders/admin/all?search=${orderA.order.orderNumber}`).set(adminAuth);
    expect(byNumber.body.orders.map((o) => o._id)).toEqual([orderA.order._id]);

    const byName = await request(app).get(`/api/orders/admin/all?search=${encodeURIComponent(`Yankee Buyer ${tag}`)}`).set(adminAuth);
    expect(byName.body.orders.map((o) => o._id)).toEqual([orderB.order._id]);

    const byEmail = await request(app).get(`/api/orders/admin/all?search=${encodeURIComponent(customerA.email)}`).set(adminAuth);
    expect(byEmail.body.orders.map((o) => o._id)).toEqual([orderA.order._id]);
  });

  test('date filters use whole days in the business timezone', async () => {
    const on20 = await list('from=2026-09-20&to=2026-09-20');
    expect(on20.body.orders.map((o) => o._id)).toEqual([orderA.order._id]);

    const on21 = await list('from=2026-09-21&to=2026-09-21');
    expect(on21.body.orders.map((o) => o._id)).toEqual([orderB.order._id]);

    const both = await list('from=2026-09-20&to=2026-09-21');
    expect(both.body.pagination.total).toBe(2);
  });

  test('rejects a malformed date filter', async () => {
    const res = await list('from=yesterday');
    expect(res.status).toBe(400);
  });

  test('status counts follow search and date but ignore the selected status', async () => {
    await request(app).put(`/api/orders/admin/${orderA.order._id}/status`).set(adminAuth).send({ status: 'Confirmed' });

    const all = await list('');
    expect(all.body.statusCounts['Pending Confirmation']).toBe(1);
    expect(all.body.statusCounts.Confirmed).toBe(1);
    expect(all.body.totalAllStatuses).toBe(2);

    const confirmedOnly = await list('status=Confirmed');
    expect(confirmedOnly.body.orders).toHaveLength(1);
    // Chips still show the other statuses' counts while one is selected.
    expect(confirmedOnly.body.statusCounts['Pending Confirmation']).toBe(1);
  });

  test('sorts the full result set by total', async () => {
    const asc = await list('sort=totalAmount&dir=asc');
    const totals = asc.body.orders.map((o) => o.totalAmount);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    expect(asc.body.orders[0]._id).toBe(orderA.order._id);
  });

  test('admin detail records who changed each status; the customer view does not expose it', async () => {
    const detail = await request(app).get(`/api/orders/admin/${orderA.order._id}`).set(adminAuth);
    const history = detail.body.order.statusHistory;
    expect(history.map((h) => h.status)).toEqual(['Pending Confirmation', 'Confirmed']);
    expect(history[0].changedBy.role).toBe('customer');
    expect(history[1].changedBy).toEqual({ name: 'History Admin', role: 'admin' });

    const mine = await request(app).get(`/api/orders/mine/${orderA.order._id}`).set(orderA.auth);
    expect(mine.status).toBe(200);
    mine.body.order.statusHistory.forEach((h) => expect(h).not.toHaveProperty('changedBy'));
  });
});

describe('Banner reordering', () => {
  let admin;
  let adminAuth;
  let originalOrders;
  const bannerIds = [];

  beforeAll(async () => {
    admin = await createTestAdmin();
    adminAuth = { Authorization: `Bearer ${generateToken(admin)}` };
    // Reordering renumbers EVERY banner (that is what makes it safe against
    // duplicate `order` values), so remember the real ones and put them back.
    originalOrders = await prisma.banner.findMany({ select: { id: true, order: true } });
    for (const name of ['One', 'Two', 'Three']) {
      const b = await prisma.banner.create({ data: { title: `Reorder ${name} ${tag}`, images: ['/x.png'], order: 0 } });
      bannerIds.push(b.id);
    }
  });

  afterAll(async () => {
    await prisma.banner.deleteMany({ where: { id: { in: bannerIds } } });
    for (const b of originalOrders) {
      await prisma.banner.update({ where: { id: b.id }, data: { order: b.order } }).catch(() => {});
    }
    await deleteTestUser(admin.id);
  });

  async function currentIds() {
    const res = await request(app).get('/api/banners/admin/all').set(adminAuth);
    return res.body.banners.map((b) => b._id);
  }

  test('persists a new order even when banners share the same order value', async () => {
    const before = await currentIds();
    const others = before.filter((id) => !bannerIds.includes(id));
    const desired = [...others, bannerIds[2], bannerIds[0], bannerIds[1]];

    const res = await request(app).put('/api/banners/reorder').set(adminAuth).send({ ids: desired });
    expect(res.status).toBe(200);
    expect(res.body.banners.map((b) => b._id)).toEqual(desired);
    expect(res.body.banners.map((b) => b.order)).toEqual(desired.map((_, i) => i));

    // And it really is stored: a fresh read returns the same sequence.
    expect(await currentIds()).toEqual(desired);
  });

  test('rejects an out-of-date list, duplicates and junk without changing anything', async () => {
    const before = await currentIds();

    const partial = await request(app).put('/api/banners/reorder').set(adminAuth).send({ ids: before.slice(1) });
    expect(partial.status).toBe(409);

    const dupes = await request(app).put('/api/banners/reorder').set(adminAuth).send({ ids: [before[0], before[0]] });
    expect(dupes.status).toBe(400);

    const junk = await request(app).put('/api/banners/reorder').set(adminAuth).send({ ids: 'nope' });
    expect(junk.status).toBe(400);

    expect(await currentIds()).toEqual(before);
  });
});

describe('Dashboard payload', () => {
  let admin;
  let adminAuth;
  let fixture;

  beforeAll(async () => {
    admin = await createTestAdmin();
    adminAuth = { Authorization: `Bearer ${generateToken(admin)}` };
    fixture = await createTestProduct({ stock: 2 });
  });

  afterAll(async () => {
    await deleteTestProduct(fixture);
    await deleteTestUser(admin.id);
  });

  test('describes its period and revenue statuses, and lists low-stock products', async () => {
    const res = await request(app).get('/api/admin/dashboard').set(adminAuth);
    expect(res.status).toBe(200);
    expect(res.body.period).toBe('all-time');
    expect(res.body.revenueStatuses).toEqual(['Payment Confirmed', 'Processing', 'Shipped', 'Delivered']);
    expect(res.body.lowStockThreshold).toBe(5);
    expect(res.body.lowStockProducts.some((p) => p._id === fixture.product.id && p.stock === 2)).toBe(true);
    // The pre-existing fields are untouched.
    ['countsByStatus', 'totalOrders', 'totalProducts', 'lowStockCount', 'confirmedRevenue', 'recentOrders'].forEach((k) =>
      expect(res.body).toHaveProperty(k)
    );
    res.body.recentOrders.forEach((o) => expect(typeof o.totalAmount).toBe('number'));
  });
});
