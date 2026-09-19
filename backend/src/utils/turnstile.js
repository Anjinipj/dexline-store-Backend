const verificationConfig = require('../config/verification');

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Calls Cloudflare's siteverify endpoint with the server-side secret — the
// only trustworthy way to know a Turnstile token is real (the client-side
// widget result is never taken at face value). Returns a plain result
// object rather than throwing on a *failed* verification (bad/expired
// token) — only genuine provider/config problems throw.
async function verifyTurnstileToken(token, { remoteIp, expectedAction } = {}) {
  if (!verificationConfig.turnstile.secretKey) {
    const err = new Error('Human verification is not configured on the server.');
    err.code = 'TURNSTILE_NOT_CONFIGURED';
    throw err;
  }

  const body = new URLSearchParams();
  body.set('secret', verificationConfig.turnstile.secretKey);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);

  const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
  const data = await res.json();

  if (!data.success) {
    return { success: false, errorCodes: data['error-codes'] || [] };
  }

  const expectedHostname = verificationConfig.turnstile.expectedHostname;
  if (expectedHostname && data.hostname && data.hostname !== expectedHostname) {
    return { success: false, errorCodes: ['hostname-mismatch'] };
  }
  if (expectedAction && data.action && data.action !== expectedAction) {
    return { success: false, errorCodes: ['action-mismatch'] };
  }

  return { success: true, hostname: data.hostname, action: data.action };
}

module.exports = { verifyTurnstileToken };
