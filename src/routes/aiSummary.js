const express = require('express');
const { userAuth } = require('../middlewares/auth');
const { getTop6ExpenseSummary } = require('../controllers/aiSummaryController');

const aiSummaryRouter = express.Router();

aiSummaryRouter.post('/ai/top-six-expense', userAuth, getTop6ExpenseSummary);

module.exports = aiSummaryRouter;
