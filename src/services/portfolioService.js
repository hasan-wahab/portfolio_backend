class PortfolioService {
  /** @param {import('../repositories/filePortfolioRepository').FilePortfolioRepository} repository */
  constructor(repository) {
    this._repository = repository;
  }

  getFullDocument() {
    return this._repository.readSync();
  }

  /** Public API payload — never send the heavy CV base64 blob to clients. */
  getPublicDocument(publicOrigin) {
    const full = this.getFullDocument();
    const doc = { ...full };
    const hasBlob = !!(doc.cvFileBase64 && String(doc.cvFileBase64).trim());
    delete doc.cvFileBase64;
    if (hasBlob && publicOrigin) {
      doc.cvUrl = `${String(publicOrigin).replace(/\/+$/, '')}/api/portfolio/cv/file`;
    }
    return doc;
  }

  /**
   * Replace portfolio document. Preserves durable CV blob if the client omitted it.
   * @param {object} body
   * @param {{ publicOrigin?: string }} [opts]
   */
  replaceFullDocument(body, opts = {}) {
    const incoming = { ...body };
    let existing = {};
    try {
      existing = this.getFullDocument();
    } catch (_) {
      existing = {};
    }

    const incomingCvUrl = String(incoming.cvUrl || '').trim();
    const clearedCv = !incomingCvUrl;

    if (clearedCv) {
      delete incoming.cvFileBase64;
      delete incoming.cvFileName;
      delete incoming.cvMimeType;
      incoming.cvUrl = '';
    } else {
      // Admin Publish often omits base64 — keep the blob already on the server.
      if (!incoming.cvFileBase64 && existing.cvFileBase64) {
        incoming.cvFileBase64 = existing.cvFileBase64;
        incoming.cvFileName = incoming.cvFileName || existing.cvFileName;
        incoming.cvMimeType = incoming.cvMimeType || existing.cvMimeType;
      }
      if (incoming.cvFileBase64 && opts.publicOrigin) {
        incoming.cvUrl = `${String(opts.publicOrigin).replace(/\/+$/, '')}/api/portfolio/cv/file`;
      } else if (incoming.cvFileBase64) {
        // Keep a stable relative-style absolute URL if we already have one pointing at the API.
        const prev = String(existing.cvUrl || '');
        if (prev.includes('/api/portfolio/cv/file')) {
          incoming.cvUrl = prev;
        }
      }
    }

    this._repository.writeSync(incoming);
    return { ok: true };
  }
}

module.exports = { PortfolioService };
