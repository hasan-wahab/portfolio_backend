const { ADMIN_TOKEN } = require('../config');

/** Bearer token must match `ADMIN_TOKEN` from `.env`. */
function requireAdminToken(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: 'ADMIN_TOKEN not set on server (.env)' });
  }
  const auth = req.headers.authorization || '';
  const token = (auth.startsWith('Bearer ') ? auth.slice(7) : '').trim();
  if (token !== ADMIN_TOKEN.trim()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { requireAdminToken };
