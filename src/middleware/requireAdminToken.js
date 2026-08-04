const { ADMIN_TOKEN } = require('../config');

/** Bearer token must match `ADMIN_TOKEN` from `.env`. */
function requireAdminToken(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({
      error: 'Admin authentication is not configured on the server.',
    });
  }
  const auth = req.headers.authorization || '';
  const token = (auth.startsWith('Bearer ') ? auth.slice(7) : '').trim();
  if (token !== ADMIN_TOKEN.trim()) {
    return res.status(401).json({
      error: 'Unauthorized. Please check your admin token.',
    });
  }
  next();
}

module.exports = { requireAdminToken };
