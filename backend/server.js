require('dotenv').config();

const app = require('./src/app');
const prisma = require('./src/lib/prisma');
const notificationService = require('./src/services/notificationService');

const PORT = process.env.PORT || 5000;

// Durable-delivery fallback for the order-notification outbox: the
// post-request "kick" (see orderService.updateOrderStatus) handles the
// normal case with low latency, but this poll is what guarantees a queued
// or retry-due row is eventually picked up even if that kick was lost to a
// crash, or a previous send attempt is waiting out its backoff.
const NOTIFICATION_POLL_INTERVAL_MS = (Number(process.env.NOTIFICATION_POLL_INTERVAL_SECONDS) || 30) * 1000;

prisma
  .$connect()
  .then(() => {
    console.log('PostgreSQL connected via Prisma');
    app.listen(PORT, () => {
      console.log(`Dexline Store API running on port ${PORT}`);
      setInterval(() => notificationService.dispatchPending(), NOTIFICATION_POLL_INTERVAL_MS);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  });
