const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');
const generateOrderNumber = require('../utils/orderNumber');
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

const ORDER_INCLUDE = { items: true, statusHistory: { orderBy: { changedAt: 'asc' } } };

async function createOrder(user, { phone, address }) {
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

    const totalAmount = itemsData.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

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
        totalAmount,
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

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id },
      data,
      include: { ...ORDER_INCLUDE, customer: { select: ADMIN_CUSTOMER_SELECT_DETAIL } },
    });

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

    return result;
  });

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
