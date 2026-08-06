const adminService = require('../services/adminService');
const { mapId } = require('../presenters/shared');

async function getDashboardStats(req, res, next) {
  try {
    const stats = await adminService.getDashboardStats();

    res.json({
      ...stats,
      recentOrders: stats.recentOrders.map((order) =>
        mapId({
          id: order.id,
          orderNumber: order.orderNumber,
          customer: order.customer ? { name: order.customer.name } : undefined,
          createdAt: order.createdAt,
          status: order.status,
        })
      ),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboardStats };
