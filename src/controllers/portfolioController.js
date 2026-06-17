const { validatePortfolioDocument } = require('../utils/validatePortfolioDocument');

/**
 * @param {import('../services/portfolioService').PortfolioService} portfolioService
 */
function createPortfolioController(portfolioService) {
  return {
    get(req, res) {
      try {
        const doc = portfolioService.getFullDocument();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json(doc);
      } catch (e) {
        res.status(500).json({ error: 'Failed to read portfolio', detail: String(e.message) });
      }
    },

    put(req, res) {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Body must be a JSON object' });
      }
      try {
        validatePortfolioDocument(req.body);
        portfolioService.replaceFullDocument(req.body);
        res.status(200).json({ ok: true });
      } catch (e) {
        const msg = String(e.message);
        if (msg.startsWith('Missing') || msg.includes('must be') || msg.startsWith('Body')) {
          return res.status(400).json({ error: 'Validation failed', detail: msg });
        }
        res.status(500).json({ error: 'Failed to write portfolio', detail: msg });
      }
    },
  };
}

module.exports = { createPortfolioController };
