const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { UPLOADS_DIR, PUBLIC_BASE_URL } = require('../config');
const { requireAdminToken } = require('../middleware/requireAdminToken');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const CV_EXTS = new Set(['.pdf', '.doc', '.docx']);

/** @type {Record<string, { filePrefix: string, jsonKey: string, allowed: Set<string>, defaultExt: string, maxBytes: number, field: string, label: string }>} */
const KINDS = {
  profile: {
    filePrefix: 'profile',
    jsonKey: 'heroProfileImageUrl',
    allowed: IMAGE_EXTS,
    defaultExt: '.jpg',
    maxBytes: 5 * 1024 * 1024,
    field: 'image',
    label: 'image',
  },
  brand: {
    filePrefix: 'brand',
    jsonKey: 'brandLogoUrl',
    allowed: IMAGE_EXTS,
    defaultExt: '.jpg',
    maxBytes: 5 * 1024 * 1024,
    field: 'image',
    label: 'image',
  },
  cv: {
    filePrefix: 'cv',
    jsonKey: 'cvUrl',
    allowed: CV_EXTS,
    defaultExt: '.pdf',
    maxBytes: 10 * 1024 * 1024,
    field: 'file',
    label: 'CV (pdf/doc/docx)',
  },
};

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function makeUpload(meta) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadsDir();
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || meta.defaultExt;
      const safe = meta.allowed.has(ext) ? ext : meta.defaultExt;
      // CV: unique name so each upload gets a fresh URL (avoids stale 404 after redeploy).
      if (meta.filePrefix === 'cv') {
        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        cb(null, `cv-${stamp}${safe}`);
        return;
      }
      cb(null, `${meta.filePrefix}${safe}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: meta.maxBytes },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mime = (file.mimetype || '').toLowerCase();
      const okExt = meta.allowed.has(ext);
      const okImageMime = mime.startsWith('image/');
      const okDocMime =
        mime.includes('pdf') ||
        mime.includes('msword') ||
        mime.includes('officedocument') ||
        mime === 'application/octet-stream';

      if (meta.filePrefix === 'cv') {
        if (okExt || (okDocMime && (!ext || okExt))) {
          cb(null, true);
        } else {
          cb(new Error(`Only PDF/DOC/DOCX allowed for CV. Got ext="${ext}" mime="${mime}"`));
        }
        return;
      }

      if (okExt || okImageMime || (mime === 'application/octet-stream' && okExt)) {
        cb(null, true);
      } else if (mime === 'application/octet-stream' && !ext) {
        cb(null, true);
      } else {
        cb(
          new Error(
            `Only image files are allowed (jpg, png, webp, gif). Got ext="${ext}" mime="${mime}"`,
          ),
        );
      }
    },
  });
}

function publicOrigin(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  return `${proto}://${host}`;
}

/**
 * POST /api/portfolio/profile-image  → heroProfileImageUrl (field: image)
 * POST /api/portfolio/brand-logo     → brandLogoUrl (field: image)
 * POST /api/portfolio/cv             → cvUrl (field: file)
 */
function createImageUploadRouters(portfolioService) {
  function handler(kindKey) {
    const meta = KINDS[kindKey];
    const upload = makeUpload(meta);
    return (req, res) => {
      upload.single(meta.field)(req, res, (err) => {
        if (err) {
          console.error('[upload]', err);
          return res.status(400).json({
            error: 'Upload failed. Please use a supported file and try again.',
          });
        }
        if (!req.file) {
          return res.status(400).json({
            error: 'No file was received. Please choose a file and try again.',
          });
        }

        const relativePath = `/uploads/${req.file.filename}`;
        const url = `${publicOrigin(req)}${relativePath}`;

        try {
          const doc = portfolioService.getFullDocument();
          // Only update this media field — never clear sibling profile/logo/CV URLs.
          if (doc && typeof doc === 'object') {
            doc[meta.jsonKey] = url;
            portfolioService.replaceFullDocument(doc);
          }
        } catch (e) {
          console.error('[upload] json update failed', e);
          return res.status(500).json({
            error: 'File was uploaded but could not be saved to your portfolio. Please try again.',
          });
        }

        return res.json({ ok: true, kind: kindKey, url, path: relativePath, field: meta.jsonKey });
      });
    };
  }

  const profileRouter = express.Router();
  profileRouter.post('/', requireAdminToken, handler('profile'));

  const brandRouter = express.Router();
  brandRouter.post('/', requireAdminToken, handler('brand'));

  const cvRouter = express.Router();
  cvRouter.post('/', requireAdminToken, handler('cv'));

  /** POST /api/portfolio/project-media — image only; returns URL (does not edit portfolio.json). */
  const projectMediaRouter = express.Router();
  const projectMediaUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        ensureUploadsDir();
        cb(null, UPLOADS_DIR);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const safe = IMAGE_EXTS.has(ext) ? ext : '.jpg';
        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        cb(null, `project-${stamp}${safe}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mime = (file.mimetype || '').toLowerCase();
      if (IMAGE_EXTS.has(ext) || mime.startsWith('image/') || mime === 'application/octet-stream') {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for project screenshots.'));
      }
    },
  });

  projectMediaRouter.post('/', requireAdminToken, (req, res) => {
    projectMediaUpload.single('image')(req, res, (err) => {
      if (err) {
        console.error('[upload] project-media', err);
        return res.status(400).json({
          error: 'Upload failed. Please use a supported image and try again.',
        });
      }
      if (!req.file) {
        return res.status(400).json({
          error: 'No file was received. Please choose a file and try again.',
        });
      }
      const relativePath = `/uploads/${req.file.filename}`;
      const url = `${publicOrigin(req)}${relativePath}`;
      return res.json({ ok: true, kind: 'project-media', url, path: relativePath });
    });
  });

  return { profileRouter, brandRouter, cvRouter, projectMediaRouter };
}

function createProfileImageRouter(portfolioService) {
  return createImageUploadRouters(portfolioService).profileRouter;
}

module.exports = {
  createImageUploadRouters,
  createProfileImageRouter,
  ensureUploadsDir,
};
