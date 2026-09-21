const nodemailer = require('nodemailer');
const verificationConfig = require('../config/verification');

let transporter = null;
let devMode = false;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    devMode = false;
    return transporter;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Email is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing). Refusing to fake delivery in production.');
  }

  // Development-only fallback. Gated strictly behind the production check
  // above, so this branch is unreachable in production even with a
  // completely missing SMTP config — it never sends anything, only logs
  // the message so a developer/tester can copy the link out of the
  // console. It never marks anyone verified by itself; the real
  // confirm-token flow still has to run.
  devMode = true;
  transporter = {
    sendMail: async (mail) => {
      console.log('\n=== [DEV MODE] Email not sent — SMTP is not configured ===');
      console.log('To:', mail.to);
      console.log('Subject:', mail.subject);
      console.log(mail.text || '(no text body)');
      console.log('=== end dev email ===\n');
      return { devMode: true };
    },
  };
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  const info = await t.sendMail({
    from: `"${verificationConfig.email.fromName}" <${verificationConfig.email.fromAddress}>`,
    to,
    subject,
    html,
    text,
  });
  // nodemailer's SMTP transport returns a provider messageId; the dev-mode
  // stub returns none. Callers that need to record what was actually sent
  // (see notificationService.js) use this instead of assuming success.
  return { devMode, messageId: info?.messageId || '' };
}

module.exports = { sendMail };
