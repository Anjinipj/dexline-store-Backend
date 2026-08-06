const ORDER_STATUSES = [
  'Pending Confirmation',
  'Payment Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
];

// Valid forward transitions in the manual, admin-driven status flow.
const NEXT_STATUS = {
  'Pending Confirmation': ['Payment Confirmed', 'Cancelled'],
  'Payment Confirmed': ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

// Statuses from which an order can still be cancelled.
const CANCELLABLE_FROM = ['Pending Confirmation', 'Payment Confirmed', 'Processing'];

module.exports = { ORDER_STATUSES, NEXT_STATUS, CANCELLABLE_FROM };
