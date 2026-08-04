const express = require('express');
const cors = require('cors');
const { FilePortfolioRepository } = require('./repositories/filePortfolioRepository');
const { PortfolioService } = require('./services/portfolioService');
const { createPortfolioController } = require('./controllers/portfolioController');
const { createPortfolioRouter } = require('./routes/portfolioRoutes');
const { createImageUploadRouters, ensureUploadsDir } = require('./routes/profileImageRoutes');
const { createContactRouter } = require('./routes/contactRoutes');
const { UPLOADS_DIR } = require('./config');

function createApp() {
  const app = express();

  ensureUploadsDir();

  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  // Profile photos + brand logos
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'hasanwahab-portfolio-backend' });
  });

  const repository = new FilePortfolioRepository();
  const portfolioService = new PortfolioService(repository);
  const portfolioController = createPortfolioController(portfolioService);
  const portfolioRouter = createPortfolioRouter(portfolioController);
  const { profileRouter, brandRouter, cvRouter } = createImageUploadRouters(portfolioService);

  app.use('/api/portfolio/profile-image', profileRouter);
  app.use('/api/portfolio/brand-logo', brandRouter);
  app.use('/api/portfolio/cv', cvRouter);
  app.use('/api/portfolio', portfolioRouter);
  app.use('/api/contact', createContactRouter());

  app.use((_req, res) => {
    res.status(404).json({ error: 'This page or endpoint was not found.' });
  });

  app.use((err, _req, res, next) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Invalid request data. Please try again.' });
    }
    if (res.headersSent) {
      return next(err);
    }
    console.error('[app]', err);
    return res.status(500).json({ error: 'Something went wrong on the server. Please try again later.' });
  });

  return app;
}

module.exports = { createApp };
