const Order = require('../models/Order');
const Product = require('../models/Product');
const { ORDER_STATUSES } = require('../models/Order');

async function getDashboardStats(req, res, next) {
  try {
    const [statusCounts, totalProducts, lowStockCount, recentOrders, revenueAgg] = await Promise.all([
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true, stock: { $lte: 5 } }),
      Order.find({}).sort({ createdAt: -1 }).limit(10).populate('customer', 'name email'),
      Order.aggregate([
        { $match: { status: { $in: ['Payment Confirmed', 'Processing', 'Shipped', 'Delivered'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const countsByStatus = ORDER_STATUSES.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});
    statusCounts.forEach((entry) => {
      countsByStatus[entry._id] = entry.count;
    });

    res.json({
      countsByStatus,
      totalOrders: statusCounts.reduce((sum, entry) => sum + entry.count, 0),
      totalProducts,
      lowStockCount,
      confirmedRevenue: revenueAgg[0]?.total || 0,
      recentOrders,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboardStats };
