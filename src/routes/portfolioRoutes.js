const express = require('express');
const { requireAdminToken } = require('../middleware/requireAdminToken');

/**
 * @param {ReturnType<import('../controllers/portfolioController').createPortfolioController>} controller
 */
function createPortfolioRouter(controller) {
  const router = express.Router();
  router.get('/', controller.get);
  router.put('/', requireAdminToken, controller.put);
  return router;
}

module.exports = { createPortfolioRouter };
