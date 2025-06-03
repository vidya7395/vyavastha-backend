const mongoose = require('mongoose');
const transaction = require('../model/transaction');

// Controller to get monthly expense summary grouped by category
const getMonthlyExpenseReport = async (req, res) => {
  try {
    // Extract the user ID from the request (assumes authentication middleware has set req.user)
    const userId = req.user._id;

    // Read the `month` query param — expected format is "YYYY-MM"
    const monthParam = req.query.month;

    // Validate the format using a regex: 4 digits - 2 digits (e.g., 2025-04)
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return res.status(400).json({
        message: 'Invalid or missing month param. Use YYYY-MM format.'
      });
    }

    // Split "YYYY-MM" into [2025, 04] and convert to numbers
    const [year, month] = monthParam.split('-').map(Number);

    // Create a start date for the 1st of the selected month
    const startDate = new Date(year, month - 1, 1);

    // Create an end date for the last day of the selected month
    // JavaScript trick: day = 0 of next month = last day of current month
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // MongoDB aggregation pipeline to get top 6 expense categories for the month
    const report = await transaction.aggregate([
      {
        // Filter only user's transactions, with type 'expense', in the given date range
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          type: 'expense',
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        // Join with categories collection (category is a reference)
        $lookup: {
          from: 'categories', // collection name in MongoDB
          localField: 'category', // field in Transaction
          foreignField: '_id', // field in Category
          as: 'category' // result will be stored in 'category' array
        }
      },
      {
        // Convert category array to a single object
        $unwind: '$category'
      },
      {
        // Group by category name and sum up the amounts
        $group: {
          _id: '$category.name', // group key
          totalAmount: { $sum: '$amount' } // sum of all expenses in that category
        }
      },
      {
        // Sort categories by amount spent, descending
        $sort: { totalAmount: -1 }
      },
      {
        // Limit to top 6 categories
        $limit: 6
      },
      {
        // Rename fields for output clarity
        $project: {
          category: '$_id',
          totalAmount: 1,
          _id: 0
        }
      }
    ]);

    // Return the month and report in the response
    return res.status(200).json({
      month: monthParam,
      report
    });
  } catch (err) {
    console.error('Expense report error:', err);
    return res
      .status(500)
      .json({ message: 'Failed to generate expense report.' });
  }
};

module.exports = {
  getMonthlyExpenseReport
};
