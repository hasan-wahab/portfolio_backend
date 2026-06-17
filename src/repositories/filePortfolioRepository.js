const fs = require('fs');
const path = require('path');
const { DATA_FILE } = require('../config');

/**
 * Single source of truth: `data/portfolio.json` (PortfolioContent shape).
 * Writes are atomic (temp file + rename) to avoid a torn/corrupt file on crash.
 */
class FilePortfolioRepository {
  readSync() {
    if (!fs.existsSync(DATA_FILE)) {
      throw new Error(`Portfolio data file not found: ${DATA_FILE}`);
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  }

  /**
   * @param {object} document
   */
  writeSync(document) {
    const json = `${JSON.stringify(document, null, 2)}\n`;
    JSON.parse(json);
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, json, 'utf8');
    try {
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) {
      try {
        fs.unlinkSync(tmp);
      } catch (_) {
        /* ignore */
      }
      throw e;
    }
  }
}

module.exports = { FilePortfolioRepository };
