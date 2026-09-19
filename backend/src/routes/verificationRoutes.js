const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const {
  turnstileVerify,
  sendEmail,
  confirmEmail,
  sendPhone,
  confirmPhone,
} = require('../controllers/verificationController');

const router = express.Router();

// IP-based backstops — the authoritative per-account cooldown/attempt
// limits live in verificationService (DB-durable, survives refreshes and
// parallel requests); these just cap overall abuse from one source.
const turnstileLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const sendLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const confirmLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post('/turnstile', turnstileLimiter, turnstileVerify);
router.post('/email/send', protect, sendLimiter, sendEmail);
router.post('/email/confirm', confirmLimiter, confirmEmail);
router.post('/phone/send', protect, sendLimiter, sendPhone);
router.post('/phone/confirm', protect, confirmLimiter, confirmPhone);

module.exports = router;
