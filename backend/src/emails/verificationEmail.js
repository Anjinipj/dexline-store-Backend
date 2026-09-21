const verificationConfig = require('../config/verification');
const { escapeHtml } = require('../utils/html');

// Branded HTML + plain-text pair for the email-verification message. Kept
// as one small builder rather than a template-file/engine, matching this
// backend's existing "plain JS module" convention (see pdfInvoiceService.js).
function buildVerificationEmail({ name, verifyUrl, expiryMinutes }) {
  const logoUrl = `${verificationConfig.appUrl}/logo.png`;
  const supportEmail = verificationConfig.email.supportEmail;
  const safeName = escapeHtml(name || 'there');
  const subject = 'Verify your email — Dexline Store';

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <div style="background:#f1f5f9;padding:32px 16px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <div style="background:#1b4fcc;padding:24px;text-align:center;">
          <img src="${logoUrl}" alt="Dexline Technologies" height="32" style="height:32px;" />
        </div>
        <div style="padding:32px 28px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Verify your email address</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
            Hi ${safeName}, thanks for creating a Dexline Store account. Please confirm this is your email address
            to continue.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${verifyUrl}" style="background:#1b4fcc;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;display:inline-block;">
              Verify email address
            </a>
          </div>
          <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
            This link expires in ${expiryMinutes} minutes and can only be used once.
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
            If the button doesn't work, copy and paste this link into your browser:<br />
            <span style="word-break:break-all;color:#1b4fcc;">${verifyUrl}</span>
          </p>
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
            If you did not request this, you can ignore this email.
          </p>
        </div>
        <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">
            Need help? Contact us at
            <a href="mailto:${supportEmail}" style="color:#1b4fcc;">${supportEmail}</a>
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    'Verify your email address',
    '',
    `Hi ${name || 'there'}, thanks for creating a Dexline Store account.`,
    'Confirm this is your email address by opening this link:',
    verifyUrl,
    '',
    `This link expires in ${expiryMinutes} minutes and can only be used once.`,
    'If you did not request this, you can ignore this email.',
    '',
    `Need help? Contact us at ${supportEmail}`,
  ].join('\n');

  return { subject, html, text };
}

module.exports = { buildVerificationEmail };
