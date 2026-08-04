const express = require('express');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../config');
const { sendContactEmail } = require('../services/mailService');

const MESSAGES_FILE = path.join(ROOT, 'data', 'contact-messages.json');

function readMessages() {
  if (!fs.existsSync(MESSAGES_FILE)) return [];
  try {
    const raw = fs.readFileSync(MESSAGES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMessages(list) {
  const dir = path.dirname(MESSAGES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const json = `${JSON.stringify(list, null, 2)}\n`;
  const tmp = `${MESSAGES_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, json, 'utf8');
  try {
    fs.renameSync(tmp, MESSAGES_FILE);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {
      /* ignore */
    }
    throw e;
  }
}

function createContactRouter() {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    const message = String(req.body?.message ?? '').trim();

    if (!name) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!message || message.length < 5) {
      return res.status(400).json({ error: 'Please write a short message.' });
    }
    if (name.length > 120 || email.length > 200 || message.length > 5000) {
      return res.status(400).json({ error: 'Your message is too long. Please shorten it and try again.' });
    }

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      email,
      message,
      createdAt: new Date().toISOString(),
      userAgent: String(req.get('user-agent') || '').slice(0, 300),
    };

    // Always keep a local copy
    try {
      const list = readMessages();
      list.unshift(entry);
      writeMessages(list.slice(0, 200));
    } catch (e) {
      console.error('[contact] failed to save message file', e);
    }

    const mail = await sendContactEmail({ name, email, message });
    if (!mail.ok) {
      console.error('[contact] email failed:', mail.error);
      return res.status(502).json({
        error: 'We could not deliver your message right now. Please try again shortly.',
        id: entry.id,
      });
    }

    return res.status(201).json({ ok: true, id: entry.id, emailed: true });
  });

  return router;
}

module.exports = { createContactRouter, MESSAGES_FILE };
