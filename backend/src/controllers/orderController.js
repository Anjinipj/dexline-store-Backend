const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { ORDER_STATUSES, CANCELLABLE_FROM } = require('../models/Order');
const generateOrderNumber = require('../utils/orderNumber');
const buildWhatsappLink = require('../utils/whatsapp');

// Valid forward transitions in the manual, admin-driven status flow.
const NEXT_STATUS = {
  'Pending Confirmation': ['Payment Confirmed', 'Cancelled'],
  'Payment Confirmed': ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

async function createOrder(req, res, next) {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    const { phone, address } = req.body;
    const customerPhone = phone || req.user.phone;
    if (!customerPhone) {
      return res.status(400).json({ message: 'A contact phone number is required' });
    }

    const items = [];
    for (const cartItem of cart.items) {
      const product = cartItem.product;
      if (!product || !product.isActive) {
        return res.status(400).json({ message: `A product in your cart is no longer available` });
      }
      if (product.stock < cartItem.quantity) {
        return res.status(400).json({ message: `${product.name} does not have enough stock` });
      }
      items.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        image: product.images?.[0] || '',
      });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      customer: req.user._id,
      customerName: req.user.name,
      customerPhone,
      shippingAddress: address || req.user.address,
      items,
      totalAmount,
      status: 'Pending Confirmation',
      statusHistory: [{ status: 'Pending Confirmation', changedBy: req.user._id }],
      whatsappSentAt: new Date(),
    });

    // Decrement stock now that the order has been placed.
    await Promise.all(
      items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: -item.quantity } }))
    );

    cart.items = [];
    await cart.save();

    const whatsappLink = buildWhatsappLink(order);
    res.status(201).json({ order, whatsappLink });
  } catch (err) {
    next(err);
  }
}

async function getMyOrders(req, res, next) {
  try {
    const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

async function getMyOrderById(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

async function listOrdersAdmin(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status && ORDER_STATUSES.includes(status)) filter.status = status;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('customer', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Order.countDocuments(filter),
    ]);

    res.json({
      orders,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
}

async function getOrderByIdAdmin(req, res, next) {
  try {
    const order = await Order.findById(req.params.id).populate('customer', 'name email phone address');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const allowedNext = NEXT_STATUS[order.status] || [];
    if (status === 'Cancelled' && !CANCELLABLE_FROM.includes(order.status)) {
      return res.status(400).json({ message: `Cannot cancel an order once it is ${order.status}` });
    }
    if (status !== 'Cancelled' && !allowedNext.includes(status)) {
      return res
        .status(400)
        .json({ message: `Cannot move order from "${order.status}" to "${status}"` });
    }

    order.status = status;
    order.statusHistory.push({ status, changedBy: req.user._id });

    if (status === 'Payment Confirmed') {
      order.paymentConfirmedAt = new Date();
      order.paymentConfirmedBy = req.user._id;
    }

    if (status === 'Cancelled') {
      // Restock items since the order will not be fulfilled.
      await Promise.all(
        order.items.map((item) =>
          Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
        )
      );
    }

    await order.save();
    res.json({ order });
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
};
