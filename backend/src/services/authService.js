const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');
const verificationService = require('./verificationService');

const SALT_ROUNDS = 10;

async function register({ name, email, password, phone, country, grantToken }) {
  if (!name || !email || !password) {
    throw new HttpError(400, 'Name, email and password are required');
  }
  if (password.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters');
  }

  // Consumed BEFORE any DB write for the new account, so a missing/expired/
  // already-used grant can never result in a half-created user — this also
  // covers "call the API directly to bypass verification", since there's
  // no client-side-only gate involved.
  await verificationService.consumeTurnstileGrant(grantToken);

  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  // Mobile number is now a required registration field (previously
  // optional/free-text) — normalized to E.164 so it's usable for SMS OTP.
  const normalizedPhone = verificationService.normalizePhone({ phone, country });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      phone: normalizedPhone,
      status: 'pending_verification',
    },
  });
  // `email` is @unique, so a genuine double-submit race is still rejected
  // by the DB (surfaced as 409 by errorHandler's P2002 handling) even
  // though we pre-checked above.

  // Registration should still succeed even if the first email send hits a
  // transient provider error — the customer can resend from the
  // verification screen, so this is deliberately non-fatal.
  try {
    await verificationService.sendEmailVerification(user);
  } catch (err) {
    console.error('Failed to send initial verification email:', err.message);
  }

  return user;
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required');
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password');
  }

  return user;
}

async function requireCurrentPassword(user, currentPassword, actionLabel) {
  if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new HttpError(401, `Enter your current password to ${actionLabel}.`);
  }
}

async function updateProfile(userId, { name, phone, country, address, email, currentPassword }) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new HttpError(404, 'Account not found');

  const data = {};
  if (name !== undefined) data.name = name;

  if (address !== undefined) {
    data.addressLine1 = address.line1 ?? existing.addressLine1;
    data.addressLine2 = address.line2 ?? existing.addressLine2;
    data.addressCity = address.city ?? existing.addressCity;
    data.addressState = address.state ?? existing.addressState;
    data.addressPincode = address.pincode ?? existing.addressPincode;
  }

  // Changing an ALREADY-VERIFIED email/phone requires the current password
  // (our stand-in for "recent authentication" in a stateless-JWT app with
  // no session-freshness concept) and never overwrites the live value
  // directly — it goes to pending{Email,Phone} until the new value is
  // itself confirmed, so the old verified contact keeps working as the
  // login/recovery route in the meantime. An unverified value (including a
  // brand-new pending account that hasn't verified yet) can still be
  // corrected directly, since there's no prior verification to protect.
  if (email !== undefined) {
    const normalizedEmail = email.toLowerCase();
    if (normalizedEmail !== existing.email.toLowerCase()) {
      const clash = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (clash && clash.id !== existing.id) throw new HttpError(409, 'An account with this email already exists');

      if (existing.emailVerifiedAt) {
        await requireCurrentPassword(existing, currentPassword, 'change your email');
        data.pendingEmail = normalizedEmail;
      } else {
        data.email = normalizedEmail;
        data.emailVerifiedAt = null;
        data.pendingEmail = null;
      }
    }
  }

  if (phone !== undefined) {
    const normalizedPhone = verificationService.normalizePhone({ phone, country });
    if (normalizedPhone !== existing.phone) {
      if (existing.phoneVerifiedAt) {
        await requireCurrentPassword(existing, currentPassword, 'change your mobile number');
        data.pendingPhone = normalizedPhone;
      } else {
        data.phone = normalizedPhone;
        data.phoneVerifiedAt = null;
        data.pendingPhone = null;
      }
    }
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });

  // Kick off a fresh verification automatically for whichever value is now
  // the unverified target, rather than leaving the customer to notice.
  const emailTargetChanged = Boolean(data.pendingEmail || (data.email && data.email !== existing.email));
  const phoneTargetChanged = Boolean(data.pendingPhone || (data.phone && data.phone !== existing.phone));

  if (emailTargetChanged) {
    try {
      await verificationService.sendEmailVerification(updated);
    } catch (err) {
      console.error('Failed to send change-of-email verification:', err.message);
    }
  }
  if (phoneTargetChanged) {
    try {
      await verificationService.sendPhoneOtp(updated);
    } catch (err) {
      console.error('Failed to send change-of-phone verification:', err.message);
    }
  }

  return updated;
}

module.exports = { register, login, updateProfile };
