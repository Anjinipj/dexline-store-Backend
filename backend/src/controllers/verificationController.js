const verificationService = require('../services/verificationService');
const userPresenter = require('../presenters/userPresenter');

function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return '****';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

async function turnstileVerify(req, res, next) {
  try {
    const { token } = req.body;
    const result = await verificationService.createTurnstileGrant({ token, ip: req.ip });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function sendEmail(req, res, next) {
  try {
    const result = await verificationService.sendEmailVerification(req.user);
    res.json({ message: 'Verification email sent.', email: maskEmail(result.email), devMode: result.devMode });
  } catch (err) {
    next(err);
  }
}

// Public (no `protect`) so a verification link opened in a different
// browser/device than the one used to register still works — the token
// itself is the proof of ownership. Only reached via a deliberate button
// click on the frontend /verify-email page, never a bare link GET.
async function confirmEmail(req, res, next) {
  try {
    const { token } = req.body;
    const user = await verificationService.confirmEmailToken(token);
    res.json({ message: 'Email verified.', user: userPresenter.toView(user) });
  } catch (err) {
    next(err);
  }
}

async function sendPhone(req, res, next) {
  try {
    const { phone, country } = req.body;
    const result = await verificationService.sendPhoneOtp(req.user, phone ? { phone, country } : undefined);
    res.json({ message: 'Verification code sent.', maskedPhone: result.maskedPhone });
  } catch (err) {
    next(err);
  }
}

async function confirmPhone(req, res, next) {
  try {
    const { code } = req.body;
    const user = await verificationService.confirmPhoneOtp(req.user, { code });
    res.json({ message: 'Mobile number verified.', user: userPresenter.toView(user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { turnstileVerify, sendEmail, confirmEmail, sendPhone, confirmPhone };
