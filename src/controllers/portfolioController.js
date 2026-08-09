const { validatePortfolioDocument } = require('../utils/validatePortfolioDocument');
const { PUBLIC_BASE_URL } = require('../config');

function requestOrigin(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  return `${proto}://${host}`;
}

/**
 * @param {import('../services/portfolioService').PortfolioService} portfolioService
 */
function createPortfolioController(portfolioService) {
  return {
    get(req, res) {
      try {
        const doc = portfolioService.getPublicDocument(requestOrigin(req));
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json(doc);
      } catch (e) {
        console.error('[portfolio] get failed', e);
        res.status(500).json({ error: 'Could not load portfolio content. Please try again.' });
      }
    },

    put(req, res) {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Invalid request. Please send a valid portfolio document.' });
      }
      try {
        validatePortfolioDocument(req.body);
        portfolioService.replaceFullDocument(req.body, { publicOrigin: requestOrigin(req) });
        res.status(200).json({ ok: true });
      } catch (e) {
        const msg = String(e.message);
        console.error('[portfolio] put failed', e);
        if (msg.startsWith('Missing') || msg.includes('must be') || msg.startsWith('Body')) {
          return res.status(400).json({
            error: 'Some required fields are missing or invalid. Please review your content and try again.',
          });
        }
        res.status(500).json({ error: 'Could not save portfolio content. Please try again.' });
      }
    },
  };
}

module.exports = { createPortfolioController };
