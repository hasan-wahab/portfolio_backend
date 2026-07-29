const path = require('path');

// Load `.env` from backend root before any code reads `process.env`.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createApp } = require('./app');
const { PORT, ADMIN_TOKEN } = require('./config');

const app = createApp();

// Render/Docker: must bind 0.0.0.0 (not only localhost) or health checks fail → restart loop.
app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Portfolio API listening on 0.0.0.0:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`  GET  /api/portfolio`);
  // eslint-disable-next-line no-console
  console.log(`  PUT  /api/portfolio  (Bearer ADMIN_TOKEN)`);
  if (!ADMIN_TOKEN) {
    // eslint-disable-next-line no-console
    console.warn('  WARNING: ADMIN_TOKEN empty — PUT /api/portfolio disabled (503).');
  }
});
