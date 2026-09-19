const crypto = require('crypto');

// URL-safe random token for links/grants (raw value goes to the client;
// only its hash — or, for Turnstile grants, the token itself as an opaque
// DB primary key — is ever persisted).
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function randomNumericCode(digits = 6) {
  const max = 10 ** digits;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(digits, '0');
}

module.exports = { randomToken, sha256, hmac, randomNumericCode };
