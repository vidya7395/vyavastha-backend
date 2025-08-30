const express = require('express');
const { userAuth } = require('../middlewares/auth');
const {
  getTop6ExpenseSummary,
  parseTransactionsFromText
} = require('../controllers/aiSummaryController');

const aiSummaryRouter = express.Router();

aiSummaryRouter.post('/ai/top-six-expense', userAuth, getTop6ExpenseSummary);
aiSummaryRouter.post(
  '/ai/parse-transactions',
  userAuth,
  parseTransactionsFromText
);

module.exports = aiSummaryRouter;
