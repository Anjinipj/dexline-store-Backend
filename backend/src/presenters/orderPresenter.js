const { mapId, toNumber, buildAddress } = require('./shared');

function baseView(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    shippingAddress: buildAddress(order, 'ship'),
    items: (order.items || []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: toNumber(item.price),
    })),
    subtotalAmount: toNumber(order.subtotalAmount),
    discountAmount: toNumber(order.discountAmount),
    handlingAmount: toNumber(order.handlingAmount),
    taxableAmount: toNumber(order.taxableAmount),
    vatRate: toNumber(order.vatRate),
    taxAmount: toNumber(order.taxAmount),
    shippingAmount: toNumber(order.shippingAmount),
    totalAmount: toNumber(order.totalAmount),
    couponCode: order.couponCode || '',
    status: order.status,
    statusHistory: (order.statusHistory || []).map((h) => ({
      status: h.status,
      changedAt: h.changedAt,
    })),
    whatsappSentAt: order.whatsappSentAt,
    paymentConfirmedAt: order.paymentConfirmedAt,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

// Customer-facing view: no populated `customer` sub-object (matches the old
// Mongoose behavior where /orders/mine* never populated the customer ref).
function toView(order) {
  if (!order) return order;
  return mapId(baseView(order));
}

// Admin-only: the order-confirmation email's delivery state. Deliberately
// omitted from the customer-facing toView — a customer has no reason to see
// retry counts or provider errors for their own order.
function confirmationEmailView(order) {
  const notification = (order.notifications || []).find((n) => n.type === 'order_confirmed');
  if (!notification) return null;
  return {
    status: notification.status,
    attempts: notification.attempts,
    maxAttempts: notification.maxAttempts,
    lastError: notification.lastError || '',
    sentAt: notification.sentAt,
    nextAttemptAt: notification.nextAttemptAt,
    updatedAt: notification.updatedAt,
  };
}

// Admin view: adds the populated `customer` sub-object the admin UI reads
// (order.customer?.name / order.customer?.email) and the confirmation
// email's delivery status.
function toAdminView(order) {
  if (!order) return order;
  const view = baseView(order);
  view.customer = order.customer
    ? {
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        ...(order.customer.addressLine1 !== undefined ? { address: buildAddress(order.customer, 'address') } : {}),
      }
    : undefined;
  view.confirmationEmail = confirmationEmailView(order);
  return mapId(view);
}

function toListView(orders) {
  return orders.map(toView);
}

function toAdminListView(orders) {
  return orders.map(toAdminView);
}

module.exports = { toView, toAdminView, toListView, toAdminListView };
