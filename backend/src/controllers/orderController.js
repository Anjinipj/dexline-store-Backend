const orderService = require('../services/orderService');
const orderPresenter = require('../presenters/orderPresenter');
const buildWhatsappLink = require('../utils/whatsapp');
const invoiceService = require('../services/invoiceService');
const { streamInvoicePdf } = require('../services/pdfInvoiceService');

async function createOrder(req, res, next) {
  try {
    const order = await orderService.createOrder(req.user, req.body);
    const whatsappLink = buildWhatsappLink(order);
    res.status(201).json({ order: orderPresenter.toView(order), whatsappLink });
  } catch (err) {
    next(err);
  }
}

async function getMyOrders(req, res, next) {
  try {
    const orders = await orderService.getMyOrders(req.user.id);
    res.json({ orders: orderPresenter.toListView(orders) });
  } catch (err) {
    next(err);
  }
}

async function getMyOrderById(req, res, next) {
  try {
    const order = await orderService.getMyOrderById(req.user.id, req.params.id);
    res.json({ order: orderPresenter.toView(order) });
  } catch (err) {
    next(err);
  }
}

async function listOrdersAdmin(req, res, next) {
  try {
    const { orders, pagination } = await orderService.listOrdersAdmin(req.query);
    res.json({ orders: orderPresenter.toAdminListView(orders), pagination });
  } catch (err) {
    next(err);
  }
}

async function getOrderByIdAdmin(req, res, next) {
  try {
    const order = await orderService.getOrderByIdAdmin(req.params.id);
    res.json({ order: orderPresenter.toAdminView(order) });
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const order = await orderService.updateOrderStatus(req.params.id, req.body.status, req.user.id);
    res.json({ order: orderPresenter.toAdminView(order) });
  } catch (err) {
    next(err);
  }
}

async function downloadInvoiceMine(req, res, next) {
  try {
    const { order, invoice } = await invoiceService.getInvoiceForOrder(req.params.id, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    streamInvoicePdf(res, { order, invoice });
  } catch (err) {
    next(err);
  }
}

async function downloadInvoiceAdmin(req, res, next) {
  try {
    const { order, invoice } = await invoiceService.getInvoiceForOrder(req.params.id, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    streamInvoicePdf(res, { order, invoice });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  getMyOrderById,
  listOrdersAdmin,
  getOrderByIdAdmin,
  updateOrderStatus,
  downloadInvoiceMine,
  downloadInvoiceAdmin,
};
