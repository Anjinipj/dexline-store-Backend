jest.mock('../src/utils/mailer', () => ({ sendMail: jest.fn() }));

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const generateToken = require('../src/utils/generateToken');
const notificationService = require('../src/services/notificationService');
const { sendMail } = require('../src/utils/mailer');
const {
  createTestUser,
  createTestAdmin,
  deleteTestUser,
  createTestProduct,
  deleteTestProduct,
} = require('./helpers');

async function placeOrder(auth, productId, phone, quantity = 1) {
  await request(app).post('/api/cart/items').set(auth).send({ productId, quantity });
  const res = await request(app).post('/api/orders').set(auth).send({ phone });
  return res.body.order;
}

async function getNotification(orderId) {
  return prisma.orderNotification.findUnique({
    where: { orderId_type: { orderId, type: 'order_confirmed' } },
  });
}

describe('Order confirmation email', () => {
  let admin;
  let adminAuth;

  beforeAll(async () => {
    admin = await createTestAdmin();
    adminAuth = { Authorization: `Bearer ${generateToken(admin)}` };
  });

  afterAll(async () => {
    await deleteTestUser(admin.id);
    await prisma.$disconnect();
  });

  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({ devMode: false, messageId: 'mock-message-id' });
  });

  test('moving Pending Confirmation -> Confirmed queues and sends the email to the customer, not the admin', async () => {
    const user = await createTestUser({ name: 'Notify Customer' });
    const fixture = await createTestProduct({ price: 200 });
    try {
      const auth = { Authorization: `Bearer ${generateToken(user)}` };
      const order = await placeOrder(auth, fixture.product.id, user.phone);

      const res = await request(app)
        .put(`/api/orders/admin/${order._id}/status`)
        .set(adminAuth)
        .send({ status: 'Confirmed' });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('Confirmed');

      // The post-commit kick is fire-and-forget; await the dispatcher
      // directly so the test doesn't depend on timing.
      await notificationService.dispatchPending();

      expect(sendMail).toHaveBeenCalledTimes(1);
      const call = sendMail.mock.calls[0][0];
      expect(call.to).toBe(user.email);
      expect(call.to).not.toBe(admin.email);
      expect(call.subject).toBe(`Your Dexline order #${order.orderNumber} is confirmed`);

      const notification = await getNotification(order._id);
      expect(notification.status).toBe('sent');
      expect(notification.providerMessageId).toBe('mock-message-id');
      expect(notification.sentAt).toBeInstanceOf(Date);
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('re-saving the same Confirmed status is rejected by the workflow and creates no duplicate notification', async () => {
    const user = await createTestUser();
    const fixture = await createTestProduct({ price: 100 });
    try {
      const auth = { Authorization: `Bearer ${generateToken(user)}` };
      const order = await placeOrder(auth, fixture.product.id, user.phone);

      await request(app).put(`/api/orders/admin/${order._id}/status`).set(adminAuth).send({ status: 'Confirmed' });

      const again = await request(app)
        .put(`/api/orders/admin/${order._id}/status`)
        .set(adminAuth)
        .send({ status: 'Confirmed' });
      expect(again.status).toBe(400);

      const count = await prisma.orderNotification.count({ where: { orderId: order._id, type: 'order_confirmed' } });
      expect(count).toBe(1);
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('queueOrderConfirmedNotification is idempotent even called twice directly — a unique constraint, not just the workflow', async () => {
    const user = await createTestUser();
    const fixture = await createTestProduct({ price: 100 });
    try {
      const auth = { Authorization: `Bearer ${generateToken(user)}` };
      const order = await placeOrder(auth, fixture.product.id, user.phone);

      await prisma.$transaction(async (tx) => {
        await notificationService.queueOrderConfirmedNotification(tx, order._id);
        await notificationService.queueOrderConfirmedNotification(tx, order._id);
      });

      const count = await prisma.orderNotification.count({ where: { orderId: order._id, type: 'order_confirmed' } });
      expect(count).toBe(1);
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('subsequent status transitions (Payment Confirmed, Processing) do not queue additional notifications', async () => {
    const user = await createTestUser();
    const fixture = await createTestProduct({ price: 100 });
    try {
      const auth = { Authorization: `Bearer ${generateToken(user)}` };
      const order = await placeOrder(auth, fixture.product.id, user.phone);

      await request(app).put(`/api/orders/admin/${order._id}/status`).set(adminAuth).send({ status: 'Confirmed' });
      await request(app).put(`/api/orders/admin/${order._id}/status`).set(adminAuth).send({ status: 'Payment Confirmed' });
      await request(app).put(`/api/orders/admin/${order._id}/status`).set(adminAuth).send({ status: 'Processing' });

      const count = await prisma.orderNotification.count({ where: { orderId: order._id } });
      expect(count).toBe(1);
      await notificationService.dispatchPending();
      expect(sendMail).toHaveBeenCalledTimes(1);
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('a transient send failure is recorded and retried later without reverting the order', async () => {
    const user = await createTestUser();
    const fixture = await createTestProduct({ price: 100 });
    try {
      const auth = { Authorization: `Bearer ${generateToken(user)}` };
      const order = await placeOrder(auth, fixture.product.id, user.phone);

      sendMail.mockRejectedValueOnce(new Error('SMTP timeout'));
      await request(app).put(`/api/orders/admin/${order._id}/status`).set(adminAuth).send({ status: 'Confirmed' });
      await notificationService.dispatchPending();

      let notification = await getNotification(order._id);
      expect(notification.status).toBe('failed');
      expect(notification.attempts).toBe(1);
      expect(notification.lastError).toContain('SMTP timeout');

      const orderRow = await prisma.order.findUnique({ where: { id: order._id } });
      expect(orderRow.status).toBe('Confirmed');

      // Make the retry due immediately instead of waiting out the backoff.
      await prisma.orderNotification.update({
        where: { id: notification.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });
      sendMail.mockResolvedValueOnce({ devMode: false, messageId: 'retry-message-id' });
      await notificationService.dispatchPending();

      notification = await getNotification(order._id);
      expect(notification.status).toBe('sent');
      expect(notification.providerMessageId).toBe('retry-message-id');
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('a malformed customer email fails with an actionable error and leaves the order Confirmed', async () => {
    const user = await createTestUser({ email: `not-an-email-${Date.now()}` });
    const fixture = await createTestProduct({ price: 100 });
    try {
      const auth = { Authorization: `Bearer ${generateToken(user)}` };
      const order = await placeOrder(auth, fixture.product.id, user.phone);

      await request(app).put(`/api/orders/admin/${order._id}/status`).set(adminAuth).send({ status: 'Confirmed' });
      await notificationService.dispatchPending();

      const notification = await getNotification(order._id);
      expect(notification.status).toBe('failed');
      expect(notification.lastError).toMatch(/missing or invalid/i);
      expect(sendMail).not.toHaveBeenCalled();

      const orderRow = await prisma.order.findUnique({ where: { id: order._id } });
      expect(orderRow.status).toBe('Confirmed');
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('the email content matches the saved items and pricing breakdown, not recalculated values', async () => {
    const user = await createTestUser({ name: 'Breakdown Checker' });
    const fixture = await createTestProduct({ price: 250 });
    try {
      const auth = { Authorization: `Bearer ${generateToken(user)}` };
      const order = await placeOrder(auth, fixture.product.id, user.phone, 2);
      // 2 x 250 = 500 subtotal, +30 handling = 530 taxable, VAT 5% = 26.50, total 556.50

      await request(app).put(`/api/orders/admin/${order._id}/status`).set(adminAuth).send({ status: 'Confirmed' });
      await notificationService.dispatchPending();

      expect(sendMail).toHaveBeenCalledTimes(1);
      const call = sendMail.mock.calls[0][0];
      expect(call.html).toContain(order.orderNumber);
      expect(call.html).toContain(fixture.product.name);
      expect(call.html).toContain('AED 500.00');
      expect(call.html).toContain('AED 30.00');
      expect(call.html).toContain('AED 530.00');
      expect(call.html).toContain('AED 26.50');
      expect(call.html).toContain('AED 556.50');
      expect(call.text).toContain('AED 556.50');
      expect(call.text).toContain(order.orderNumber);
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('resend reuses the same row; concurrent duplicate resend requests do not double-queue or double-send', async () => {
    const user = await createTestUser();
    const fixture = await createTestProduct({ price: 100 });
    try {
      const auth = { Authorization: `Bearer ${generateToken(user)}` };
      const order = await placeOrder(auth, fixture.product.id, user.phone);

      sendMail.mockRejectedValueOnce(new Error('temporary outage'));
      await request(app).put(`/api/orders/admin/${order._id}/status`).set(adminAuth).send({ status: 'Confirmed' });
      await notificationService.dispatchPending();
      expect((await getNotification(order._id)).status).toBe('failed');

      sendMail.mockReset();
      sendMail.mockResolvedValue({ devMode: false, messageId: 'resend-message-id' });

      const [r1, r2] = await Promise.all([
        request(app).post(`/api/orders/admin/${order._id}/resend-confirmation-email`).set(adminAuth),
        request(app).post(`/api/orders/admin/${order._id}/resend-confirmation-email`).set(adminAuth),
      ]);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);

      await notificationService.dispatchPending();

      expect(sendMail).toHaveBeenCalledTimes(1);
      const count = await prisma.orderNotification.count({ where: { orderId: order._id, type: 'order_confirmed' } });
      expect(count).toBe(1);
      expect((await getNotification(order._id)).status).toBe('sent');
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('resending on an order that was never confirmed is rejected', async () => {
    const user = await createTestUser();
    const fixture = await createTestProduct({ price: 100 });
    try {
      const auth = { Authorization: `Bearer ${generateToken(user)}` };
      const order = await placeOrder(auth, fixture.product.id, user.phone);

      const res = await request(app)
        .post(`/api/orders/admin/${order._id}/resend-confirmation-email`)
        .set(adminAuth);
      expect(res.status).toBe(400);
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });

  test('unauthorised users cannot change order status or trigger a resend', async () => {
    const user = await createTestUser();
    const fixture = await createTestProduct({ price: 100 });
    try {
      const auth = { Authorization: `Bearer ${generateToken(user)}` };
      const order = await placeOrder(auth, fixture.product.id, user.phone);

      const noToken = await request(app).put(`/api/orders/admin/${order._id}/status`).send({ status: 'Confirmed' });
      expect(noToken.status).toBe(401);

      // A logged-in customer (not an admin) is still not authorised.
      const asCustomer = await request(app)
        .put(`/api/orders/admin/${order._id}/status`)
        .set(auth)
        .send({ status: 'Confirmed' });
      expect(asCustomer.status).toBe(403);

      const resendNoToken = await request(app).post(`/api/orders/admin/${order._id}/resend-confirmation-email`);
      expect(resendNoToken.status).toBe(401);

      const resendAsCustomer = await request(app)
        .post(`/api/orders/admin/${order._id}/resend-confirmation-email`)
        .set(auth);
      expect(resendAsCustomer.status).toBe(403);

      const stillPending = await prisma.order.findUnique({ where: { id: order._id } });
      expect(stillPending.status).toBe('Pending Confirmation');
    } finally {
      await deleteTestUser(user.id);
      await deleteTestProduct(fixture);
    }
  });
});
