// A product is "low stock" at or below this many units. This is the rule the
// dashboard count, the inventory report, and the admin product filter all
// share — it includes products that are completely out of stock.
const LOW_STOCK_THRESHOLD = 5;

module.exports = { LOW_STOCK_THRESHOLD };
