const nodemailer = require('nodemailer');
const { FilePortfolioRepository } = require('../repositories/filePortfolioRepository');

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}

function resolveToEmail() {
  const fromEnv = (process.env.CONTACT_TO_EMAIL || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const doc = new FilePortfolioRepository().readSync();
    const email = String(doc.contactEmail || '').trim();
    if (email) return email;
  } catch (_) {
    /* ignore */
  }
  return (process.env.SMTP_USER || process.env.RESEND_FROM_EMAIL || '').trim();
}

function buildBodies({ name, email, message }) {
  const subject = `Portfolio contact — ${name}`;
  const text = [
    'New message from your portfolio contact form.',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    '',
    'Message:',
    message,
  ].join('\n');

  const html = `
    <div style="font-family:sans-serif;line-height:1.5;color:#111">
      <p><strong>New portfolio contact</strong></p>
      <p><strong>Name:</strong> ${escapeHtml(name)}<br/>
      <strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      <p><strong>Message:</strong></p>
      <pre style="white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:8px">${escapeHtml(message)}</pre>
    </div>
  `;
  return { subject, text, html };
}

/**
 * Railway / many clouds block outbound SMTP (587/465) → ETIMEDOUT.
 * Resend uses HTTPS API and works on Railway.
 */
async function sendViaResend({ name, email, message, to }) {
  const apiKey = process.env.RESEND_API_KEY.trim();
  const from =
    (process.env.RESEND_FROM_EMAIL || '').trim() ||
    'Portfolio Contact <onboarding@resend.dev>';
  const { subject, text, html } = buildBodies({ name, email, message });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[mail] Resend failed:', res.status, body);
    return { ok: false, error: 'Email service could not send the message.' };
  }
  return { ok: true };
}

async function sendViaSmtp({ name, email, message, to }) {
  const host = process.env.SMTP_HOST.trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER.trim();
  const pass = process.env.SMTP_PASS.trim();
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const { subject, text, html } = buildBodies({ name, email, message });

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"Portfolio Contact" <${user}>`,
    to,
    replyTo: email,
    subject,
    text,
    html,
  });
  return { ok: true };
}

/**
 * Sends contact form to the portfolio owner inbox.
 * Prefers Resend (HTTPS) → then SMTP (local / unrestricted networks).
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
async function sendContactEmail({ name, email, message }) {
  const to = resolveToEmail();
  if (!to) {
    return { ok: false, error: 'No destination email is configured.' };
  }

  if (!resendConfigured() && !smtpConfigured()) {
    return {
      ok: false,
      error:
        'Email delivery is not configured. Set RESEND_API_KEY (recommended on Railway) or SMTP_* vars.',
    };
  }

  try {
    if (resendConfigured()) {
      return await sendViaResend({ name, email, message, to });
    }
    return await sendViaSmtp({ name, email, message, to });
  } catch (e) {
    const code = e && e.code;
    console.error('[mail] sendMail failed:', e);
    if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
      return {
        ok: false,
        error:
          'Could not connect to the mail server (timeout). On Railway use RESEND_API_KEY instead of Gmail SMTP.',
      };
    }
    return { ok: false, error: 'Email provider rejected the message.' };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendContactEmail, smtpConfigured, resendConfigured };
