const path = require('path');
const fs = require('fs');
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

  // Uploaded media (profile, brand, CV, project shots)
  app.use('/uploads', (req, res, next) => {
    // ?download=1 → force download (portfolio "Download" option)
    if (req.query.download === '1' || req.query.download === 'true') {
      const name = path.basename(req.path);
      if (!name || name === '.' || name === '..') {
        return res.status(400).json({ error: 'Invalid file name.' });
      }
      const filePath = path.join(UPLOADS_DIR, name);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          error: 'File not found. Please re-upload the CV/image in Admin (Railway disk may have been cleared on redeploy).',
        });
      }
      return res.download(filePath, name);
    }
    return next();
  });
  app.use('/uploads', express.static(UPLOADS_DIR, { fallthrough: true }));


  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'hasanwahab-portfolio-backend' });
  });

  const repository = new FilePortfolioRepository();
  const portfolioService = new PortfolioService(repository);
  const portfolioController = createPortfolioController(portfolioService);
  const portfolioRouter = createPortfolioRouter(portfolioController);
  const { profileRouter, brandRouter, cvRouter, projectMediaRouter } =
    createImageUploadRouters(portfolioService);

  app.use('/api/portfolio/profile-image', profileRouter);
  app.use('/api/portfolio/brand-logo', brandRouter);
  app.use('/api/portfolio/cv', cvRouter);
  app.use('/api/portfolio/project-media', projectMediaRouter);
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
