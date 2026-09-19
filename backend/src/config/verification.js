// Central, documented defaults for every verification-related timing/limit.
// All are overridable via env vars — see backend/.env.example for the full
// list and the effective defaults if unset.
//
// Every field is a getter that reads `process.env` fresh on each access,
// rather than a value computed once at require-time — so tests can flip an
// env var mid-run to exercise "provider not configured" paths, and a env
// var change can never be masked by an earlier cached read.
function intFromEnv(name, fallback) {
  const raw = process.env[name];
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const verificationConfig = {
  get appUrl() {
    return process.env.APP_URL || process.env.CLIENT_ORIGIN || 'http://localhost:3000';
  },

  turnstile: {
    get secretKey() {
      return process.env.TURNSTILE_SECRET_KEY || '';
    },
    get expectedHostname() {
      return process.env.TURNSTILE_EXPECTED_HOSTNAME || '';
    },
    get grantExpiryMinutes() {
      return intFromEnv('TURNSTILE_GRANT_EXPIRY_MINUTES', 10);
    },
  },

  email: {
    get verificationExpiryMinutes() {
      return intFromEnv('EMAIL_VERIFICATION_EXPIRY_MINUTES', 30);
    },
    get resendCooldownSeconds() {
      return intFromEnv('EMAIL_RESEND_COOLDOWN_SECONDS', 60);
    },
    get fromName() {
      return process.env.EMAIL_FROM_NAME || 'Dexline Store';
    },
    get fromAddress() {
      return process.env.EMAIL_FROM_ADDRESS || 'no-reply@dexline.store';
    },
    get supportEmail() {
      return process.env.SUPPORT_EMAIL || 'support@dexline.store';
    },
  },

  sms: {
    get otpExpiryMinutes() {
      return intFromEnv('SMS_OTP_EXPIRY_MINUTES', 5);
    },
    get resendCooldownSeconds() {
      return intFromEnv('SMS_RESEND_COOLDOWN_SECONDS', 60);
    },
    get maxAttempts() {
      return intFromEnv('SMS_MAX_ATTEMPTS', 5);
    },
    get maxSendsPerDay() {
      return intFromEnv('SMS_MAX_SENDS_PER_DAY', 5);
    },
  },

  // Used to keyed-hash locally-generated OTP codes in the dev-only SMS
  // fallback. Falls back to JWT_SECRET only so local dev doesn't need yet
  // another var out of the box — set a distinct OTP_HASH_SECRET in any
  // real deployment.
  get otpHashSecret() {
    return process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || '';
  },
};

module.exports = verificationConfig;
