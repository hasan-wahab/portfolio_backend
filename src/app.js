const express = require('express');
const cors = require('cors');
const { FilePortfolioRepository } = require('./repositories/filePortfolioRepository');
const { PortfolioService } = require('./services/portfolioService');
const { createPortfolioController } = require('./controllers/portfolioController');
const { createPortfolioRouter } = require('./routes/portfolioRoutes');

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'hasanwahab-portfolio-backend' });
  });

  const repository = new FilePortfolioRepository();
  const portfolioService = new PortfolioService(repository);
  const portfolioController = createPortfolioController(portfolioService);
  const portfolioRouter = createPortfolioRouter(portfolioController);

  app.use('/api/portfolio', portfolioRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, _req, res, next) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Invalid JSON body', detail: err.message });
    }
    if (res.headersSent) {
      return next(err);
    }
    return res.status(500).json({ error: 'Internal server error', detail: String(err.message) });
  });

  return app;
}

module.exports = { createApp };
