const reportService = require('../services/reportService');
const { toCsv } = require('../utils/csv');

async function getSalesReport(req, res, next) {
  try {
    const { from, to, format } = req.query;
    const report = await reportService.getSalesReport({ from, to });

    if (format === 'csv') {
      const csv = toCsv(report.daily, [
        { key: 'date', header: 'Date' },
        { key: 'orderCount', header: 'Orders' },
        { key: 'revenue', header: 'Revenue' },
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sales-report.csv"');
      return res.send(csv);
    }

    res.json(report);
  } catch (err) {
    next(err);
  }
}

async function getInventoryReport(req, res, next) {
  try {
    const { lowStockThreshold, format } = req.query;
    const report = await reportService.getInventoryReport({ lowStockThreshold });

    if (format === 'csv') {
      const csv = toCsv(report.items, [
        { key: 'name', header: 'Product' },
        { key: 'category', header: 'Category' },
        { key: 'brand', header: 'Brand' },
        { key: 'stock', header: 'Stock' },
        { key: 'price', header: 'Price' },
        { key: 'stockValue', header: 'Stock Value' },
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory-report.csv"');
      return res.send(csv);
    }

    res.json(report);
  } catch (err) {
    next(err);
  }
}

module.exports = { getSalesReport, getInventoryReport };
