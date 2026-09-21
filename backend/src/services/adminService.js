const prisma = require('../lib/prisma');
const { ORDER_STATUSES } = require('../constants/orderStatus');
const { LOW_STOCK_THRESHOLD } = require('../constants/inventory');

// The statuses whose saved order totals count towards "confirmed revenue".
// These are order-status based: there is no payments table, so this is the
// sum of saved order totals (items - discount + handling + VAT) for orders an
// admin has marked Payment Confirmed or later — not a ledger of money received.
// Cancelled orders are excluded even if they were once payment-confirmed
// (refunds are not tracked anywhere).
const CONFIRMED_STATUSES = ['Payment Confirmed', 'Processing', 'Shipped', 'Delivered'];

const LOW_STOCK_PREVIEW_COUNT = 8;

async function getDashboardStats() {
  const lowStockWhere = { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } };

  const [statusCounts, totalProducts, lowStockCount, recentOrders, revenueAgg, lowStockProducts] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: lowStockWhere }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { customer: { select: { name: true, email: true } } },
    }),
    prisma.order.aggregate({
      where: { status: { in: CONFIRMED_STATUSES } },
      _sum: { totalAmount: true },
    }),
    prisma.product.findMany({
      where: lowStockWhere,
      orderBy: [{ stock: 'asc' }, { name: 'asc' }],
      take: LOW_STOCK_PREVIEW_COUNT,
      select: { id: true, name: true, stock: true, brand: { select: { name: true } } },
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
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    lowStockProducts,
    confirmedRevenue: Number(revenueAgg._sum.totalAmount || 0),
    // Describes exactly what the numbers above cover, so the UI can state it
    // instead of guessing: every figure is all-time (no date window), and
    // revenue is summed over these statuses only.
    period: 'all-time',
    revenueStatuses: CONFIRMED_STATUSES,
    generatedAt: new Date().toISOString(),
    recentOrders,
  };
}

module.exports = { getDashboardStats, CONFIRMED_STATUSES };
