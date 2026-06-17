class PortfolioService {
  /** @param {import('../repositories/filePortfolioRepository').FilePortfolioRepository} repository */
  constructor(repository) {
    this._repository = repository;
  }

  getFullDocument() {
    return this._repository.readSync();
  }

  /**
   * Replace entire portfolio document (must match Flutter `PortfolioContent` JSON).
   * @param {object} body
   */
  replaceFullDocument(body) {
    this._repository.writeSync(body);
    return { ok: true };
  }
}

module.exports = { PortfolioService };
