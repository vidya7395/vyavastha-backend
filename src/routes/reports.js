const express = require('express');
const { userAuth } = require('../middlewares/auth');
const { getMonthlyExpenseReport } = require('../controllers/reportsController');
const reportsRouter = express.Router();
// /api/transactions?category=food

// GET /api/transactions?startDate=2024-02-01&endDate=2024-02-10

// GET /api/transactions?sortBy=amount&order=asc

reportsRouter.get(
  '/expenses-category/report',
  userAuth,
  getMonthlyExpenseReport
);

module.exports = reportsRouter;
