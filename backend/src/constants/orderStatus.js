const ORDER_STATUSES = [
  'Pending Confirmation',
  'Confirmed',
  'Payment Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
];

// Valid forward transitions in the manual, admin-driven status flow.
// "Confirmed" is a distinct, earlier step than "Payment Confirmed" — an
// admin accepting/verifying the order itself (this business manually
// verifies every order), separate from payment actually being received.
// See notificationService.js: the transition INTO "Confirmed" is what
// queues the order-confirmation email.
const NEXT_STATUS = {
  'Pending Confirmation': ['Confirmed', 'Cancelled'],
  Confirmed: ['Payment Confirmed', 'Cancelled'],
  'Payment Confirmed': ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

// Statuses from which an order can still be cancelled.
const CANCELLABLE_FROM = ['Pending Confirmation', 'Confirmed', 'Payment Confirmed', 'Processing'];

module.exports = { ORDER_STATUSES, NEXT_STATUS, CANCELLABLE_FROM };
