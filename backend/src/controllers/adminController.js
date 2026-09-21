const adminService = require('../services/adminService');
const { mapId } = require('../presenters/shared');

async function getDashboardStats(req, res, next) {
  try {
    const stats = await adminService.getDashboardStats();

    res.json({
      ...stats,
      lowStockProducts: stats.lowStockProducts.map((p) =>
        mapId({ id: p.id, name: p.name, stock: p.stock, brand: p.brand?.name || '' })
      ),
      recentOrders: stats.recentOrders.map((order) =>
        mapId({
          id: order.id,
          orderNumber: order.orderNumber,
          customer: order.customer ? { name: order.customer.name } : undefined,
          totalAmount: Number(order.totalAmount),
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
