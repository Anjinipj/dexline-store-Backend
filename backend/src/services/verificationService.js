const { parsePhoneNumberFromString } = require('libphonenumber-js');
const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');
const verificationConfig = require('../config/verification');
const { randomToken, sha256 } = require('../utils/tokens');
const { verifyTurnstileToken } = require('../utils/turnstile');
const { sendMail } = require('../utils/mailer');
const { buildVerificationEmail } = require('../emails/verificationEmail');
const smsProvider = require('./smsProvider');

const MINUTE = 60 * 1000;

// ---------------------------------------------------------------------------
// Turnstile: one-time registration grant
// ---------------------------------------------------------------------------

async function createTurnstileGrant({ token, ip }) {
  if (!token) throw new HttpError(400, 'Human verification is required.');

  let result;
  try {
    result = await verifyTurnstileToken(token, { remoteIp: ip, expectedAction: 'register' });
  } catch (err) {
    if (err.code === 'TURNSTILE_NOT_CONFIGURED') {
      throw new HttpError(503, 'Human verification is not configured. Please contact support.');
    }
    throw new HttpError(502, 'Could not reach the verification provider. Please try again.');
  }

  if (!result.success) {
    throw new HttpError(400, 'Human verification failed or expired. Please try again.');
  }

  // The grant token itself doubles as the DB row's id: a 32-byte random
  // value has as much entropy as a hash of a secret would, so there's no
  // need for a separate secret+hash pair the way password reset tokens
  // sometimes use — single-use is enforced by the atomic updateMany below,
  // not by secrecy of the lookup key.
  const grantToken = randomToken(24);
  const expiresAt = new Date(Date.now() + verificationConfig.turnstile.grantExpiryMinutes * MINUTE);
  await prisma.turnstileGrant.create({ data: { id: grantToken, ip: ip || '', expiresAt } });

  return { grantToken, expiresAt };
}

// Atomically claims the grant: the single UPDATE ... WHERE consumedAt IS
// NULL is what actually prevents two concurrent registration attempts (or
// a replayed request) from both succeeding on the same grant.
async function consumeTurnstileGrant(grantToken) {
  if (!grantToken) throw new HttpError(400, 'Human verification is required.');
  const result = await prisma.turnstileGrant.updateMany({
    where: { id: grantToken, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (result.count !== 1) {
    throw new HttpError(400, 'Human verification has expired or was already used. Please verify again.');
  }
}

// ---------------------------------------------------------------------------
// Phone normalization
// ---------------------------------------------------------------------------

function normalizePhone({ phone, country }) {
  if (!phone) throw new HttpError(400, 'Mobile number is required.');
  const parsed = parsePhoneNumberFromString(phone, country || 'AE');
  if (!parsed || !parsed.isValid()) {
    throw new HttpError(400, 'Enter a valid mobile number.');
  }
  return parsed.number; // E.164, e.g. +9715XXXXXXXX
}

// ---------------------------------------------------------------------------
// Account activation
// ---------------------------------------------------------------------------

async function maybeActivateAccount(user) {
  if (user.status === 'active') return user;
  if (user.emailVerifiedAt && user.phoneVerifiedAt) {
    return prisma.user.update({ where: { id: user.id }, data: { status: 'active' } });
  }
  return user;
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

function emailCooldownMs() {
  return verificationConfig.email.resendCooldownSeconds * 1000;
}

async function sendEmailVerification(user) {
  const targetEmail = (user.pendingEmail || user.email).toLowerCase();

  // Cooldown is enforced from a durable DB row (most recent token for this
  // exact user+email pair), not an in-memory timer — a page refresh,
  // parallel tab, or retried request can't reset it.
  const recent = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, email: targetEmail },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    const elapsed = Date.now() - recent.createdAt.getTime();
    if (elapsed < emailCooldownMs()) {
      const waitSeconds = Math.ceil((emailCooldownMs() - elapsed) / 1000);
      throw new HttpError(429, `Please wait ${waitSeconds}s before requesting another email.`);
    }
  }

  const rawToken = randomToken(32);
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + verificationConfig.email.verificationExpiryMinutes * MINUTE);

  await prisma.emailVerificationToken.create({
    data: { userId: user.id, email: targetEmail, tokenHash, expiresAt },
  });

  const verifyUrl = `${verificationConfig.appUrl}/verify-email?token=${rawToken}`;
  const { subject, html, text } = buildVerificationEmail({
    name: user.name,
    verifyUrl,
    expiryMinutes: verificationConfig.email.verificationExpiryMinutes,
  });

  const { devMode } = await sendMail({ to: targetEmail, subject, html, text });
  return { email: targetEmail, devMode };
}

// Called only from a deliberate user click on the /verify-email page (never
// from the bare GET of a link) so automated link-scanners that merely
// fetch the email can't burn the token before the real recipient clicks.
async function confirmEmailToken(rawToken) {
  if (!rawToken) throw new HttpError(400, 'This verification link is invalid or has expired.');
  const tokenHash = sha256(rawToken);

  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.consumedAt || record.expiresAt < new Date()) {
    throw new HttpError(400, 'This verification link is invalid or has expired.');
  }

  const consumeResult = await prisma.emailVerificationToken.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumeResult.count !== 1) {
    throw new HttpError(400, 'This verification link is invalid or has expired.');
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new HttpError(400, 'This verification link is invalid or has expired.');

  const data = { emailVerifiedAt: new Date() };
  if (user.pendingEmail && user.pendingEmail.toLowerCase() === record.email.toLowerCase()) {
    // Confirms a verified-email CHANGE — promote the new address now; the
    // previously-verified address was kept live as the login/recovery
    // contact right up until this exact moment.
    data.email = record.email;
    data.pendingEmail = null;
  } else if (user.email.toLowerCase() !== record.email.toLowerCase()) {
    // Token matches neither the account's current email nor its current
    // pending change (e.g. superseded by a later change request) — stale.
    throw new HttpError(400, 'This verification link is invalid or has expired.');
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return maybeActivateAccount(updated);
}

// ---------------------------------------------------------------------------
// Phone (SMS OTP) verification
// ---------------------------------------------------------------------------

function smsCooldownMs() {
  return verificationConfig.sms.resendCooldownSeconds * 1000;
}

async function sendPhoneOtp(user, override) {
  const targetPhone = override?.phone
    ? normalizePhone({ phone: override.phone, country: override.country })
    : user.pendingPhone || user.phone;

  if (!targetPhone) throw new HttpError(400, 'Add a mobile number before requesting a code.');

  const recent = await prisma.phoneVerification.findFirst({
    where: { userId: user.id, phone: targetPhone },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    const elapsed = Date.now() - recent.createdAt.getTime();
    if (elapsed < smsCooldownMs()) {
      const waitSeconds = Math.ceil((smsCooldownMs() - elapsed) / 1000);
      throw new HttpError(429, `Please wait ${waitSeconds}s before requesting another code.`);
    }
  }

  const since = new Date(Date.now() - 24 * 60 * MINUTE);
  const sentToday = await prisma.phoneVerification.count({ where: { userId: user.id, createdAt: { gt: since } } });
  if (sentToday >= verificationConfig.sms.maxSendsPerDay) {
    throw new HttpError(429, 'Too many verification codes requested today. Please try again tomorrow.');
  }

  let sendResult;
  try {
    sendResult = await smsProvider.sendOtp(targetPhone);
  } catch (err) {
    if (err.code === 'SMS_NOT_CONFIGURED') {
      throw new HttpError(503, 'Mobile verification is not configured. Please contact support.');
    }
    throw new HttpError(502, 'Could not send the verification code. Please try again.');
  }

  const expiresAt = new Date(Date.now() + verificationConfig.sms.otpExpiryMinutes * MINUTE);
  await prisma.phoneVerification.create({
    data: {
      userId: user.id,
      phone: targetPhone,
      provider: sendResult.provider,
      providerRef: sendResult.providerRef || '',
      codeHash: sendResult.codeHash || '',
      maxAttempts: verificationConfig.sms.maxAttempts,
      expiresAt,
    },
  });

  return { phone: targetPhone, maskedPhone: smsProvider.maskPhone(targetPhone) };
}

async function confirmPhoneOtp(user, { code } = {}) {
  if (!code) throw new HttpError(400, 'Enter the code sent to your phone.');

  const record = await prisma.phoneVerification.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || record.expiresAt < new Date()) {
    throw new HttpError(400, 'This code has expired. Please request a new one.');
  }
  if (record.attempts >= record.maxAttempts) {
    throw new HttpError(429, 'Too many incorrect attempts. Please request a new code.');
  }

  const ok = await smsProvider.checkOtp({
    provider: record.provider,
    phone: record.phone,
    code,
    codeHash: record.codeHash,
  });

  if (!ok) {
    await prisma.phoneVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, 'Incorrect or expired code.');
  }

  // Prevent a successful challenge from ever being replayed/reused — the
  // atomic updateMany is what actually enforces single-use.
  const consumeResult = await prisma.phoneVerification.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumeResult.count !== 1) {
    throw new HttpError(400, 'This code has already been used.');
  }

  const data = { phoneVerifiedAt: new Date() };
  if (user.pendingPhone && user.pendingPhone === record.phone) {
    data.phone = record.phone;
    data.pendingPhone = null;
  } else if (user.phone !== record.phone) {
    throw new HttpError(400, 'This code no longer matches your current mobile number.');
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return maybeActivateAccount(updated);
}

module.exports = {
  createTurnstileGrant,
  consumeTurnstileGrant,
  normalizePhone,
  maybeActivateAccount,
  sendEmailVerification,
  confirmEmailToken,
  sendPhoneOtp,
  confirmPhoneOtp,
};
