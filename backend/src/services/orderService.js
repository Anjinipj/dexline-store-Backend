const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');
const generateOrderNumber = require('../utils/orderNumber');
const couponService = require('./couponService');
const pricingService = require('./pricingService');
const notificationService = require('./notificationService');
const { ORDER_STATUSES, NEXT_STATUS, CANCELLABLE_FROM } = require('../constants/orderStatus');

const ADMIN_CUSTOMER_SELECT_LIST = { name: true, email: true, phone: true };
const ADMIN_CUSTOMER_SELECT_DETAIL = {
  name: true,
  email: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  addressCity: true,
  addressState: true,
  addressPincode: true,
};

const ORDER_INCLUDE = {
  items: true,
  statusHistory: { orderBy: { changedAt: 'asc' } },
  notifications: true,
};

async function createOrder(user, { phone, address, couponCode }) {
  const customerPhone = phone || user.phone;
  if (!customerPhone) {
    throw new HttpError(400, 'A contact phone number is required');
  }

  const order = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId: user.id },
      include: { items: { include: { product: true } } },
    });
    if (!cart || cart.items.length === 0) {
      throw new HttpError(400, 'Your cart is empty');
    }

    // Validate the coupon (if any) against the pre-decrement subtotal, inside
    // this same transaction, before touching stock. This runs alongside — not
    // instead of — the atomic stock check-and-decrement loop below; a failure
    // here or there rolls back everything identically.
    const cartLineItems = cart.items.map((i) => ({ price: i.product.price, quantity: i.quantity }));
    const { itemsSubtotal: preSubtotal } = pricingService.calculateOrderTotals(cartLineItems);
    let coupon = null;
    let discountAmount = 0;
    if (couponCode) {
      const result = await couponService.findValidCoupon(couponCode, preSubtotal, tx);
      coupon = result.coupon;
      discountAmount = result.discountAmount;
    }

    const itemsData = [];
    for (const cartItem of cart.items) {
      const product = cartItem.product;
      if (!product || !product.isActive) {
        throw new HttpError(400, 'A product in your cart is no longer available');
      }

      // Atomic check-and-decrement: the WHERE clause only matches if enough stock
      // is still available at the moment this statement runs, so two concurrent
      // checkouts racing for the last unit can never both succeed.
      const result = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: cartItem.quantity } },
        data: { stock: { decrement: cartItem.quantity } },
      });
      if (result.count === 0) {
        throw new HttpError(400, `${product.name} does not have enough stock`);
      }

      itemsData.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        image: product.images?.[0] || '',
      });
    }

    // Recomputed from the actually-created itemsData (the post-stock-check
    // snapshot), through the same shared function the cart/coupon previews
    // use — this is the one call that actually persists, so it is the
    // authoritative, backend-trusted total. Never derived from anything the
    // client sent.
    const totals = pricingService.calculateOrderTotals(itemsData, { discountAmount });

    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerId: user.id,
        customerName: user.name,
        customerPhone,
        shipLine1: address?.line1 ?? user.addressLine1 ?? '',
        shipLine2: address?.line2 ?? user.addressLine2 ?? '',
        shipCity: address?.city ?? user.addressCity ?? '',
        shipState: address?.state ?? user.addressState ?? '',
        shipPincode: address?.pincode ?? user.addressPincode ?? '',
        subtotalAmount: totals.itemsSubtotal,
        discountAmount: totals.discountAmount,
        handlingAmount: totals.handlingAmount,
        taxableAmount: totals.taxableAmount,
        vatRate: totals.vatRate,
        taxAmount: totals.vatAmount,
        shippingAmount: 0,
        totalAmount: totals.totalAmount,
        couponId: coupon?.id ?? null,
        couponCode: coupon?.code ?? '',
        status: 'Pending Confirmation',
        whatsappSentAt: new Date(),
        items: { create: itemsData },
        statusHistory: { create: [{ status: 'Pending Confirmation', changedById: user.id }] },
      },
      include: ORDER_INCLUDE,
    });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  });

  return order;
}

async function getMyOrders(userId) {
  return prisma.order.findMany({
    where: { customerId: userId },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

async function getMyOrderById(userId, orderId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId: userId },
    include: ORDER_INCLUDE,
  });
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }
  return order;
}

async function listOrdersAdmin({ status, page = 1, limit = 20 }) {
  const filter = {};
  if (status && ORDER_STATUSES.includes(status)) filter.status = status;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: filter,
      include: { ...ORDER_INCLUDE, customer: { select: ADMIN_CUSTOMER_SELECT_LIST } },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.order.count({ where: filter }),
  ]);

  return { orders, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } };
}

async function getOrderByIdAdmin(id) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { ...ORDER_INCLUDE, customer: { select: ADMIN_CUSTOMER_SELECT_DETAIL } },
  });
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }
  return order;
}

async function updateOrderStatus(id, status, adminId) {
  if (!ORDER_STATUSES.includes(status)) {
    throw new HttpError(400, 'Invalid status value');
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }

  const allowedNext = NEXT_STATUS[order.status] || [];
  if (status === 'Cancelled' && !CANCELLABLE_FROM.includes(order.status)) {
    throw new HttpError(400, `Cannot cancel an order once it is ${order.status}`);
  }
  if (status !== 'Cancelled' && !allowedNext.includes(status)) {
    throw new HttpError(400, `Cannot move order from "${order.status}" to "${status}"`);
  }

  const data = { status, statusHistory: { create: [{ status, changedById: adminId }] } };
  if (status === 'Payment Confirmed') {
    data.paymentConfirmedAt = new Date();
    data.paymentConfirmedById = adminId;
  }

  // Every side-effect write below runs BEFORE the final tx.order.update —
  // that update's `include` is what the caller (and the admin API response)
  // actually sees, so anything created earlier in the same transaction
  // (the invoice, the notification row) is guaranteed to already be there
  // when it resolves. Doing it the other way around — update first, side
  // effects after — would return a response whose `notifications`/`invoice`
  // still reflected the pre-transaction state, even though everything did
  // commit together.
  const updated = await prisma.$transaction(async (tx) => {
    if (status === 'Cancelled') {
      // Restock every line item — atomic together with the status update above,
      // so a crash mid-way can't leave stock restored without the order actually
      // showing as cancelled, or vice versa.
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        }
      }
    }

    if (status === 'Payment Confirmed') {
      // Reserve a sequential invoice number the moment payment is confirmed,
      // atomically with the status update — additive to this transaction, no
      // change to the restock-on-cancel logic above. Guarded with findUnique
      // in case this transition is ever re-entered (defense-in-depth; the
      // state machine already prevents re-entering "Payment Confirmed" once left).
      const existingInvoice = await tx.invoice.findUnique({ where: { orderId: id } });
      if (!existingInvoice) {
        const [{ nextval }] = await tx.$queryRaw`SELECT nextval('invoice_number_seq') as nextval`;
        await tx.invoice.create({
          data: {
            orderId: id,
            invoiceNumber: `INV-${new Date().getFullYear()}-${String(nextval).padStart(6, '0')}`,
          },
        });
      }
    }

    if (status === 'Confirmed') {
      // Transactional outbox: queued in the SAME transaction as the status
      // change it belongs to, so a committed "Confirmed" status can never
      // end up with no notification row — only after this commits does
      // anything attempt to actually send it (see the kickDispatch call
      // below, and notificationService.dispatchPending as the durable
      // fallback). The state machine only ever allows entering "Confirmed"
      // from "Pending Confirmation" and never allows re-entering it once
      // left, and queueOrderConfirmedNotification is additionally guarded
      // by a DB-unique constraint — so this can only ever run once per order.
      await notificationService.queueOrderConfirmedNotification(tx, id);
    }

    return tx.order.update({
      where: { id },
      data,
      include: { ...ORDER_INCLUDE, customer: { select: ADMIN_CUSTOMER_SELECT_DETAIL } },
    });
  });

  if (status === 'Confirmed') {
    // Only after the transaction has committed — never send (or even
    // attempt to send) based on a status change that could still roll back.
    notificationService.kickDispatch();
  }

  return updated;
}

module.exports = {
  createOrder,
  getMyOrders,
  getMyOrderById,
  listOrdersAdmin,
  getOrderByIdAdmin,
  updateOrderStatus,
};
