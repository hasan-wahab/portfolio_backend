const { hasCvAsset, clearCvAsset } = require('../routes/cvFileRoutes');

class PortfolioService {
  /** @param {import('../repositories/filePortfolioRepository').FilePortfolioRepository} repository */
  constructor(repository) {
    this._repository = repository;
  }

  getFullDocument() {
    return this._repository.readSync();
  }

  getPublicDocument(publicOrigin) {
    const full = this.getFullDocument();
    const doc = { ...full };
    delete doc.cvFileBase64;
    const origin = publicOrigin ? String(publicOrigin).replace(/\/+$/, '') : '';
    if (hasCvAsset() && origin) {
      doc.cvUrl = `${origin}/api/portfolio/cv/file`;
    }
    return doc;
  }

  /**
   * Replace portfolio JSON. CV bytes stay in data/cv/ unless cvUrl is cleared.
   */
  replaceFullDocument(body, opts = {}) {
    const incoming = { ...body };
    let existing = {};
    try {
      existing = this.getFullDocument();
    } catch (_) {
      existing = {};
    }

    delete incoming.cvFileBase64;

    const clearedCv = !String(incoming.cvUrl || '').trim();

    if (clearedCv) {
      clearCvAsset();
      incoming.cvUrl = '';
      delete incoming.cvFileName;
      delete incoming.cvMimeType;
    } else {
      if (!incoming.cvFileName && existing.cvFileName) {
        incoming.cvFileName = existing.cvFileName;
      }
      if (!incoming.cvMimeType && existing.cvMimeType) {
        incoming.cvMimeType = existing.cvMimeType;
      }
      if (hasCvAsset() && opts.publicOrigin) {
        incoming.cvUrl = `${String(opts.publicOrigin).replace(/\/+$/, '')}/api/portfolio/cv/file`;
      }
    }

    this._repository.writeSync(incoming);
    return { ok: true };
  }
}

module.exports = { PortfolioService };
