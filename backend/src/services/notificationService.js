const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');
const { sendMail } = require('../utils/mailer');
const { buildOrderConfirmedEmail } = require('../emails/orderConfirmedEmail');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Minutes to wait before each retry, indexed by the attempt count so far
// (0 -> retry in 1 min, 1 -> 5 min, ... capped at the last entry).
const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 240];

function backoffMinutes(attemptsSoFar) {
  return RETRY_BACKOFF_MINUTES[Math.min(attemptsSoFar, RETRY_BACKOFF_MINUTES.length - 1)];
}

// Queues the order-confirmation notification. Must be called from INSIDE
// the same DB transaction that flips an order's status to "Confirmed" (see
// orderService.updateOrderStatus) — this is the transactional-outbox
// pattern: the notification row commits atomically with the status change,
// so a successful status update can never silently lose its notification
// (a crash right after commit still leaves the row for the poller to find).
//
// @@unique([orderId, type]) on OrderNotification is the idempotency
// guarantee: at most one row can ever exist per order — "send only once
// per order, ever" falls out of the database constraint rather than
// needing to be reasoned about here.
//
// Implemented as an upsert (Postgres INSERT ... ON CONFLICT DO UPDATE),
// not create()-and-catch(P2002): a single failed statement inside a
// Postgres transaction aborts that ENTIRE transaction regardless of
// whether the resulting error is caught in application code — so if two
// admin requests raced to confirm the same order, the loser's caught
// P2002 would still poison its transaction and roll back the order-status
// update along with it. upsert never raises a constraint error in the
// first place, so a race (or, as in a test, two calls in the same
// transaction) always resolves cleanly with exactly one row.
async function queueOrderConfirmedNotification(tx, orderId) {
  await tx.orderNotification.upsert({
    where: { orderId_type: { orderId, type: 'order_confirmed' } },
    create: { orderId, type: 'order_confirmed' },
    update: { orderId },
  });
}

async function loadOrderForEmail(orderId) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: { select: { name: true, email: true } } },
  });
}

// Atomically claims one row (queued/failed -> sending). Two overlapping
// dispatch passes (the post-request kick and the poller, or a resend
// racing the poller) can both try to claim the same row, but only the
// UPDATE that actually matches proceeds — this is what prevents a
// duplicate send, not any in-process locking.
async function claimNotification(id) {
  const result = await prisma.orderNotification.updateMany({
    where: { id, status: { in: ['queued', 'failed'] } },
    data: { status: 'sending' },
  });
  return result.count === 1;
}

async function sendOne(notification) {
  const claimed = await claimNotification(notification.id);
  if (!claimed) return;

  try {
    const order = await loadOrderForEmail(notification.orderId);
    if (!order) throw new Error('Order no longer exists');

    const email = order.customer?.email || '';
    if (!EMAIL_RE.test(email)) {
      // Not a transient failure — retrying won't fix a missing/malformed
      // address. Still recorded as `failed` (never silently dropped) so it
      // shows up as an actionable admin error; it just won't be picked up
      // again by the automatic retry loop below once attempts are spent.
      throw new Error(`Customer email is missing or invalid (${email ? `"${email}"` : 'empty'})`);
    }

    // Built from the saved order only — never recalculated from current
    // catalogue prices.
    const { subject, html, text } = buildOrderConfirmedEmail({ order });
    const result = await sendMail({ to: email, subject, html, text });

    await prisma.orderNotification.update({
      where: { id: notification.id },
      data: { status: 'sent', sentAt: new Date(), providerMessageId: result.messageId || '', lastError: '' },
    });
  } catch (err) {
    const attempts = notification.attempts + 1;
    await prisma.orderNotification.update({
      where: { id: notification.id },
      data: {
        status: 'failed',
        attempts,
        lastError: String(err.message || err).slice(0, 500),
        nextAttemptAt: new Date(Date.now() + backoffMinutes(notification.attempts) * 60 * 1000),
      },
    });
  }
}

let inFlight = null;

async function runDispatchPass() {
  try {
    const candidates = await prisma.orderNotification.findMany({
      where: { OR: [{ status: 'queued' }, { status: 'failed', nextAttemptAt: { lte: new Date() } }] },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    const due = candidates.filter((n) => n.status === 'queued' || n.attempts < n.maxAttempts);
    for (const notification of due) {
      await sendOne(notification);
    }
  } catch (err) {
    console.error('notificationService.dispatchPending failed:', err.message);
  }
}

// The delivery half of the outbox: finds anything queued or due for retry
// and attempts to send it. Exhausted rows (attempts >= maxAttempts) are
// deliberately excluded — they stay `failed` and visible to the admin,
// waiting for an explicit resend rather than retrying forever.
//
// Safe to call concurrently with itself: claimNotification's atomic UPDATE
// is what actually guards against a double-send, but a concurrent call
// still needs to behave correctly as an "at least one full pass happens"
// primitive — so rather than a bare boolean flag that would let a second
// caller's await return immediately having done (or waited for) nothing,
// concurrent callers share and await the SAME in-flight pass. This is what
// lets the post-status-update kick and an explicit dispatchPending() call
// (e.g. in tests, or the periodic poller) race safely: whichever runs
// second still waits for a real pass to finish before resolving.
function dispatchPending() {
  if (!inFlight) {
    inFlight = runDispatchPass().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

// Fire-and-forget "kick" so a freshly queued notification doesn't have to
// wait for the next poll tick under normal conditions. Never awaited by an
// HTTP handler — the poller (started in server.js) is the durable
// fallback, so a failure or crash here never loses the notification, only
// delays it until the next poll.
function kickDispatch() {
  dispatchPending().catch((err) => console.error('notificationService.kickDispatch failed:', err.message));
}

// Admin-triggered resend — reuses the SAME row (the @@unique constraint
// means there is only ever one to reuse), so it can never create a second
// notification for the same order.
//
// Duplicate-click protection is enforced at the database layer, not just a
// disabled button: the reset only applies `WHERE status IN ('sent',
// 'failed')`. A second click (or a retried network request) while the
// first is still `queued`/`sending` matches zero rows and is a no-op that
// returns the current (already in-flight) state instead of queuing twice.
async function resendOrderConfirmedNotification(orderId) {
  const notification = await prisma.orderNotification.findUnique({
    where: { orderId_type: { orderId, type: 'order_confirmed' } },
  });
  if (!notification) {
    throw new HttpError(400, 'This order has not been confirmed yet — there is no confirmation email to resend.');
  }

  const claimed = await prisma.orderNotification.updateMany({
    where: { id: notification.id, status: { in: ['sent', 'failed'] } },
    data: { status: 'queued', attempts: 0, lastError: '', nextAttemptAt: new Date() },
  });

  if (claimed.count > 0) {
    kickDispatch();
  }

  return prisma.orderNotification.findUnique({ where: { id: notification.id } });
}

module.exports = {
  queueOrderConfirmedNotification,
  dispatchPending,
  kickDispatch,
  resendOrderConfirmedNotification,
};
