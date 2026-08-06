const prisma = require('../lib/prisma');
const { ORDER_STATUSES } = require('../constants/orderStatus');

const LOW_STOCK_THRESHOLD = 5;
const CONFIRMED_STATUSES = ['Payment Confirmed', 'Processing', 'Shipped', 'Delivered'];

async function getDashboardStats() {
  const [statusCounts, totalProducts, lowStockCount, recentOrders, revenueAgg] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { customer: { select: { name: true, email: true } } },
    }),
    prisma.order.aggregate({
      where: { status: { in: CONFIRMED_STATUSES } },
      _sum: { totalAmount: true },
    }),
  ]);

  const countsByStatus = ORDER_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
  statusCounts.forEach((entry) => {
    countsByStatus[entry.status] = entry._count._all;
  });

  return {
    countsByStatus,
    totalOrders: statusCounts.reduce((sum, entry) => sum + entry._count._all, 0),
    totalProducts,
    lowStockCount,
    confirmedRevenue: Number(revenueAgg._sum.totalAmount || 0),
    recentOrders,
  };
}

module.exports = { getDashboardStats };
