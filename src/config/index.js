const path = require('path');

// This file lives at src/config/index.js → backend root is ../..
const ROOT = path.join(__dirname, '..', '..');

require('dotenv').config({ path: path.join(ROOT, '.env') });

module.exports = {
  ROOT,
  // Render injects PORT (often 10000). Local default 8787.
  PORT: Number(process.env.PORT) || 8787,
  ADMIN_TOKEN: (process.env.ADMIN_TOKEN || '').trim(),
  DATA_FILE: path.join(ROOT, 'data', 'portfolio.json'),
  UPLOADS_DIR: path.join(ROOT, 'data', 'uploads'),
  /** Optional absolute public origin, e.g. https://xxx.up.railway.app */
  PUBLIC_BASE_URL: (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, ''),
};
