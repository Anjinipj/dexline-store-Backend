const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');

const ORDER_INCLUDE = {
  items: true,
  invoice: true,
  customer: { select: { name: true, email: true, phone: true } },
};

// Loads the order + invoice for download, enforcing ownership (customers can
// only download their own) and that payment has actually been confirmed.
async function getInvoiceForOrder(orderId, requestingUser) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }
  if (requestingUser.role !== 'admin' && order.customerId !== requestingUser.id) {
    throw new HttpError(404, 'Order not found');
  }
  if (!order.invoice) {
    throw new HttpError(404, 'Invoice not available until payment is confirmed');
  }

  return { order, invoice: order.invoice };
}

module.exports = { getInvoiceForOrder };
