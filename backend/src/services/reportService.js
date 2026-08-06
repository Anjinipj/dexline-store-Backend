const prisma = require('../lib/prisma');
const { CONFIRMED_STATUSES } = require('./adminService');
const { toNumber } = require('../presenters/shared');

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

function parseRange({ from, to }) {
  const fromDate = from ? new Date(from) : new Date(0);
  // `to` is a calendar date from a date picker — extend to end-of-day so that
  // day's orders aren't silently excluded.
  const toDate = to ? new Date(to) : new Date();
  toDate.setHours(23, 59, 59, 999);
  return { fromDate, toDate };
}

async function getSalesReport({ from, to }) {
  const { fromDate, toDate } = parseRange({ from, to });
  const where = { createdAt: { gte: fromDate, lte: toDate } };
  const confirmedWhere = { ...where, status: { in: CONFIRMED_STATUSES } };

  const [totalOrders, confirmedAgg, dailyRows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({
      where: confirmedWhere,
      _count: { _all: true },
      _sum: { totalAmount: true, discountAmount: true },
    }),
    prisma.$queryRaw`
      SELECT date_trunc('day', "createdAt") AS day,
             COUNT(*)::int AS "orderCount",
             COALESCE(SUM("totalAmount"), 0) AS revenue
      FROM "Order"
      WHERE "createdAt" >= ${fromDate} AND "createdAt" <= ${toDate} AND "status" = ANY(${CONFIRMED_STATUSES})
      GROUP BY day
      ORDER BY day ASC
    `,
  ]);

  return {
    from: fromDate,
    to: toDate,
    totalOrders,
    confirmedOrders: confirmedAgg._count._all,
    confirmedRevenue: toNumber(confirmedAgg._sum.totalAmount) || 0,
    totalDiscount: toNumber(confirmedAgg._sum.discountAmount) || 0,
    daily: dailyRows.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      orderCount: row.orderCount,
      revenue: toNumber(row.revenue),
    })),
  };
}

async function getInventoryReport({ lowStockThreshold } = {}) {
  const threshold = Number(lowStockThreshold) || DEFAULT_LOW_STOCK_THRESHOLD;

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: { select: { name: true } }, brand: { select: { name: true } } },
    orderBy: { stock: 'asc' },
  });

  const items = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category?.name || '',
    brand: p.brand?.name || '',
    stock: p.stock,
    price: toNumber(p.price),
    stockValue: toNumber(p.price) * p.stock,
  }));

  const totalStockValue = items.reduce((sum, i) => sum + i.stockValue, 0);
  const lowStockItems = items.filter((i) => i.stock <= threshold);

  return {
    threshold,
    totalProducts: items.length,
    totalUnitsInStock: items.reduce((sum, i) => sum + i.stock, 0),
    totalStockValue,
    lowStockCount: lowStockItems.length,
    items,
    lowStockItems,
  };
}

module.exports = { getSalesReport, getInventoryReport };
