const crypto = require('crypto');
const verificationConfig = require('../config/verification');
const { randomNumericCode, hmac } = require('../utils/tokens');

let twilioClient = null;
function getTwilioClient() {
  if (twilioClient) return twilioClient;
  // eslint-disable-next-line global-require
  const twilio = require('twilio');
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return twilioClient;
}

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID
  );
}

function maskPhone(phone) {
  if (!phone || phone.length < 4) return '****';
  return `${'*'.repeat(Math.max(phone.length - 4, 0))}${phone.slice(-4)}`;
}

// Twilio Verify owns the whole OTP lifecycle (generation, expiry, resend
// throttling, attempt counting) — we only keep `providerRef` for our own
// bookkeeping/rate-limit rows, never a code.
async function sendViaTwilio(phone) {
  const client = getTwilioClient();
  const verification = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verifications.create({ to: phone, channel: 'sms' });
  return { provider: 'twilio', providerRef: verification.sid, codeHash: '' };
}

async function checkViaTwilio(phone, code) {
  const client = getTwilioClient();
  const check = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({ to: phone, code });
  return check.status === 'approved';
}

// Development-only fallback for when no SMS provider is configured. The
// caller (verificationService) refuses to reach this path at all when
// NODE_ENV === 'production' — see sendOtp below — so it can't be enabled
// accidentally in production even with missing Twilio env vars. Generates
// a real random 6-digit code and stores only a keyed HMAC of it, never the
// plaintext code; the code itself is only ever logged to the server
// console, never sent as a real SMS.
function sendViaConsole(phone) {
  const code = randomNumericCode(6);
  console.log('\n=== [DEV MODE] SMS not sent — no SMS provider configured ===');
  console.log(`To: ${maskPhone(phone)}`);
  console.log(`OTP code: ${code}`);
  console.log('=== end dev SMS ===\n');
  return { provider: 'console', providerRef: '', codeHash: hmac(code, verificationConfig.otpHashSecret) };
}

function checkViaConsole(codeHash, submittedCode) {
  if (!codeHash) return false;
  const submittedHash = hmac(String(submittedCode || '').trim(), verificationConfig.otpHashSecret);
  return crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(codeHash));
}

async function sendOtp(phone) {
  if (isTwilioConfigured()) return sendViaTwilio(phone);

  if (process.env.NODE_ENV === 'production') {
    const err = new Error('SMS verification is not configured on the server.');
    err.code = 'SMS_NOT_CONFIGURED';
    throw err;
  }

  return sendViaConsole(phone);
}

async function checkOtp({ provider, phone, code, codeHash }) {
  if (provider === 'twilio') return checkViaTwilio(phone, code);
  return checkViaConsole(codeHash, code);
}

module.exports = { sendOtp, checkOtp, maskPhone, isTwilioConfigured };
