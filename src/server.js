const path = require('path');

// Load `.env` from backend root before any code reads `process.env`.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createApp } = require('./app');
const { PORT, ADMIN_TOKEN } = require('./config');

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Portfolio API http://127.0.0.1:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`  GET  http://127.0.0.1:${PORT}/api/portfolio`);
  // eslint-disable-next-line no-console
  console.log(`  PUT  http://127.0.0.1:${PORT}/api/portfolio  (Bearer ADMIN_TOKEN)`);
  if (!ADMIN_TOKEN) {
    // eslint-disable-next-line no-console
    console.warn('  WARNING: ADMIN_TOKEN empty — PUT /api/portfolio disabled (503).');
  }
});
