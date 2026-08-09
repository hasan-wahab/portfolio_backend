const path = require('path');
const fs = require('fs');
const express = require('express');
const { UPLOADS_DIR, PUBLIC_BASE_URL } = require('../config');

function mimeFromName(name) {
  const n = String(name || '').toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (n.endsWith('.doc')) return 'application/msword';
  return 'application/octet-stream';
}

function publicOrigin(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  return `${proto}://${host}`;
}

/** Stable public CV URL (survives redeploys when blob is in portfolio.json). */
function stableCvApiUrl(req) {
  return `${publicOrigin(req)}/api/portfolio/cv/file`;
}

/**
 * Load CV bytes: prefer portfolio.json blob (durable), else disk fallback.
 * @returns {{ buffer: Buffer, filename: string, mime: string } | null}
 */
function loadCvPayload(doc) {
  if (!doc || typeof doc !== 'object') return null;

  if (doc.cvFileBase64 && String(doc.cvFileBase64).trim()) {
    try {
      const buffer = Buffer.from(String(doc.cvFileBase64), 'base64');
      if (buffer.length === 0) return null;
      const filename = String(doc.cvFileName || 'cv.pdf').replace(/[^\w.\-()+ ]+/g, '_') || 'cv.pdf';
      const mime = String(doc.cvMimeType || mimeFromName(filename));
      return { buffer, filename, mime };
    } catch (_) {
      /* fall through */
    }
  }

  // Legacy: try /uploads/... from cvUrl
  const cvUrl = String(doc.cvUrl || '').trim();
  if (!cvUrl) return null;
  try {
    const u = new URL(cvUrl, 'http://localhost');
    const base = path.basename(u.pathname);
    if (!base || base === '/' || base.includes('..')) return null;
    const filePath = path.join(UPLOADS_DIR, base);
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    return { buffer, filename: base, mime: mimeFromName(base) };
  } catch (_) {
    return null;
  }
}

/**
 * Public CV file routes (no auth).
 * GET /api/portfolio/cv/file?mode=view|download
 */
function createCvFileRouter(portfolioService) {
  const router = express.Router();

  router.get('/file', (req, res) => {
    try {
      const doc = portfolioService.getFullDocument();
      const payload = loadCvPayload(doc);
      if (!payload) {
        return res.status(404).json({
          error: 'CV is not available. Please upload it again from Admin and Publish.',
        });
      }

      const mode = String(req.query.mode || 'view').toLowerCase();
      const asAttachment = mode === 'download';
      const disposition = asAttachment ? 'attachment' : 'inline';

      res.setHeader('Content-Type', payload.mime);
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="${payload.filename.replace(/"/g, '')}"`,
      );
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).send(payload.buffer);
    } catch (e) {
      console.error('[cv] serve failed', e);
      return res.status(500).json({ error: 'Could not open the CV. Please try again.' });
    }
  });

  return router;
}

module.exports = {
  createCvFileRouter,
  loadCvPayload,
  stableCvApiUrl,
  mimeFromName,
  publicOrigin,
};
