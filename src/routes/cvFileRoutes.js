const path = require('path');
const fs = require('fs');
const express = require('express');
const { ROOT, UPLOADS_DIR, PUBLIC_BASE_URL } = require('../config');

/** CV bytes live here — separate from portfolio.json so Admin Publish never wipes the file. */
const CV_DIR = path.join(ROOT, 'data', 'cv');
const CV_BIN = path.join(CV_DIR, 'current.bin');
const CV_META = path.join(CV_DIR, 'meta.json');

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

function stableCvApiUrl(req) {
  return `${publicOrigin(req)}/api/portfolio/cv/file`;
}

function ensureCvDir() {
  if (!fs.existsSync(CV_DIR)) {
    fs.mkdirSync(CV_DIR, { recursive: true });
  }
}

function saveCvAsset(buffer, meta) {
  ensureCvDir();
  fs.writeFileSync(CV_BIN, buffer);
  fs.writeFileSync(
    CV_META,
    `${JSON.stringify(
      {
        filename: meta.filename,
        mime: meta.mime,
        savedAt: new Date().toISOString(),
        bytes: buffer.length,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

function clearCvAsset() {
  try {
    if (fs.existsSync(CV_BIN)) fs.unlinkSync(CV_BIN);
  } catch (_) {
    /* ignore */
  }
  try {
    if (fs.existsSync(CV_META)) fs.unlinkSync(CV_META);
  } catch (_) {
    /* ignore */
  }
}

function readCvMeta() {
  try {
    if (!fs.existsSync(CV_META)) return null;
    return JSON.parse(fs.readFileSync(CV_META, 'utf8'));
  } catch (_) {
    return null;
  }
}

function hasCvAsset() {
  try {
    return fs.existsSync(CV_BIN) && fs.statSync(CV_BIN).size > 0;
  } catch (_) {
    return false;
  }
}

function isPdfPayload(payload) {
  const mime = String(payload.mime || '').toLowerCase();
  const name = String(payload.filename || '').toLowerCase();
  return mime.includes('pdf') || name.endsWith('.pdf');
}

/**
 * @param {object} doc portfolio.json
 * @returns {{ buffer: Buffer, filename: string, mime: string } | null}
 */
function loadCvPayload(doc) {
  if (hasCvAsset()) {
    try {
      const buffer = fs.readFileSync(CV_BIN);
      const meta = readCvMeta() || {};
      const filename =
        String(meta.filename || (doc && doc.cvFileName) || 'cv.pdf').replace(/[^\w.\-()+ ]+/g, '_') ||
        'cv.pdf';
      const mime = String(meta.mime || (doc && doc.cvMimeType) || mimeFromName(filename));
      return { buffer, filename, mime };
    } catch (e) {
      console.error('[cv] read asset failed', e);
    }
  }

  if (doc && doc.cvFileBase64 && String(doc.cvFileBase64).trim()) {
    try {
      const buffer = Buffer.from(String(doc.cvFileBase64), 'base64');
      if (buffer.length === 0) return null;
      const filename = String(doc.cvFileName || 'cv.pdf').replace(/[^\w.\-()+ ]+/g, '_') || 'cv.pdf';
      const mime = String(doc.cvMimeType || mimeFromName(filename));
      try {
        saveCvAsset(buffer, { filename, mime });
      } catch (_) {
        /* ignore */
      }
      return { buffer, filename, mime };
    } catch (_) {
      /* fall through */
    }
  }

  const cvUrl = doc ? String(doc.cvUrl || '').trim() : '';
  if (!cvUrl || cvUrl.includes('/api/portfolio/cv')) return null;
  try {
    const u = new URL(cvUrl, 'http://localhost');
    const base = path.basename(u.pathname);
    if (!base || base === '/' || base.includes('..')) return null;
    const filePath = path.join(UPLOADS_DIR, base);
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    const mime = mimeFromName(base);
    try {
      saveCvAsset(buffer, { filename: base, mime });
    } catch (_) {
      /* ignore */
    }
    return { buffer, filename: base, mime };
  } catch (_) {
    return null;
  }
}

function createCvFileRouter(portfolioService) {
  const router = express.Router();

  function loadDoc() {
    try {
      return portfolioService.getFullDocument();
    } catch (_) {
      return {};
    }
  }

  function sendBytes(res, payload, asAttachment) {
    const safeName = payload.filename.replace(/"/g, '');
    res.setHeader('Content-Type', payload.mime);
    res.setHeader(
      'Content-Disposition',
      `${asAttachment ? 'attachment' : 'inline'}; filename="${safeName}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(payload.buffer);
  }

  function missing(res) {
    return res.status(404).json({
      error: 'CV is not available. Please upload it again from Admin (then Publish).',
    });
  }

  // Raw bytes (used by Office viewer + direct open)
  router.get('/raw', (req, res) => {
    try {
      const payload = loadCvPayload(loadDoc());
      if (!payload) return missing(res);
      return sendBytes(res, payload, false);
    } catch (e) {
      console.error('[cv] raw failed', e);
      return res.status(500).json({ error: 'Could not open the CV. Please try again.' });
    }
  });

  // View in browser: PDF inline; Word → Microsoft Office online viewer
  router.get('/view', (req, res) => {
    try {
      const payload = loadCvPayload(loadDoc());
      if (!payload) return missing(res);

      if (!isPdfPayload(payload)) {
        const rawUrl = `${publicOrigin(req)}/api/portfolio/cv/raw`;
        const office = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(rawUrl)}`;
        return res.redirect(302, office);
      }

      return sendBytes(res, payload, false);
    } catch (e) {
      console.error('[cv] view failed', e);
      return res.status(500).json({ error: 'Could not open the CV. Please try again.' });
    }
  });

  // Force download
  router.get('/download', (req, res) => {
    try {
      const payload = loadCvPayload(loadDoc());
      if (!payload) return missing(res);
      return sendBytes(res, payload, true);
    } catch (e) {
      console.error('[cv] download failed', e);
      return res.status(500).json({ error: 'Could not open the CV. Please try again.' });
    }
  });

  // Compat alias
  router.get('/file', (req, res) => {
    const mode = String(req.query.mode || 'view').toLowerCase();
    if (mode === 'download') {
      return res.redirect(302, `${publicOrigin(req)}/api/portfolio/cv/download`);
    }
    return res.redirect(302, `${publicOrigin(req)}/api/portfolio/cv/view`);
  });

  return router;
}

module.exports = {
  createCvFileRouter,
  loadCvPayload,
  saveCvAsset,
  clearCvAsset,
  hasCvAsset,
  stableCvApiUrl,
  mimeFromName,
  publicOrigin,
  CV_DIR,
};
