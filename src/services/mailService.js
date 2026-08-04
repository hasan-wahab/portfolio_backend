const nodemailer = require('nodemailer');
const { FilePortfolioRepository } = require('../repositories/filePortfolioRepository');

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
  return (process.env.SMTP_USER || '').trim();
}

/**
 * Sends contact form to the portfolio owner inbox.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
async function sendContactEmail({ name, email, message }) {
  if (!smtpConfigured()) {
    return {
      ok: false,
      error: 'Email delivery is not configured on the server.',
    };
  }

  const to = resolveToEmail();
  if (!to) {
    return { ok: false, error: 'No destination email is configured.' };
  }

  const host = process.env.SMTP_HOST.trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER.trim();
  const pass = process.env.SMTP_PASS.trim();
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const subject = `Portfolio contact — ${name}`;
  const text = [
    `New message from your portfolio contact form.`,
    ``,
    `Name: ${name}`,
    `Email: ${email}`,
    ``,
    `Message:`,
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

  try {
    await transporter.sendMail({
      from: `"Portfolio Contact" <${user}>`,
      to,
      replyTo: email,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (e) {
    console.error('[mail] sendMail failed:', e);
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

module.exports = { sendContactEmail, smtpConfigured };
