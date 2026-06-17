const path = require('path');

/** Load .env from project root (parent of `src/`). */
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const ROOT = path.join(__dirname, '..', '..');

module.exports = {
  ROOT,
  PORT: Number(process.env.PORT) || 8787,
  ADMIN_TOKEN: (process.env.ADMIN_TOKEN || '').trim(),
  DATA_FILE: path.join(ROOT, 'data', 'portfolio.json'),
};
