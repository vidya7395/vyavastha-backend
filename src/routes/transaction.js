const express = require('express');
const Transaction = require('../model/transaction');
const Category = require('../model/category');
const { userAuth } = require('../middlewares/auth');
const { default: mongoose, isValidObjectId } = require('mongoose');
const { calculateRecurringDetails } = require('../utils/recurring');
const transactionRouter = express.Router();
// /api/transactions?category=food

// GET /api/transactions?startDate=2024-02-01&endDate=2024-02-10

// GET /api/transactions?sortBy=amount&order=asc

transactionRouter.get('/transaction', userAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('Userid', userId);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 🔹 Filters
    const category = req.query.category;
    const startDate = req.query.startDate; // YYYY-MM-DD
    const endDate = req.query.endDate; // YYYY-MM-DD
    const sortBy = req.query.sortBy || 'date'; // Default: sort by date
    const sortOrder = req.query.order === 'asc' ? 1 : -1; // Default: newest first

    let query = { user: userId };

    // ✅ Fix category filter (convert to ObjectId)
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.category = new mongoose.Types.ObjectId(category);
    }

    // ✅ Filter by date range
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // ✅ Fetch transactions based on filters, sorting, and pagination
    const transactions = await Transaction.find(query)
      .populate('category', 'name') // Include category name
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({ transactions, page, limit });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// POST /api/transactions: Create a new transaction for the authenticated user
transactionRouter.post('/transaction', userAuth, async (req, res) => {
  try {
    // Retrieve the user ID from the header
    const userId = req.user._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const transactions = req.body; // Expecting an array of transactions

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res
        .status(400)
        .json({ message: 'Provide at least one transaction.' });
    }

    const createdTransactions = [];

    for (const transactionData of transactions) {
      const {
        amount,
        date,
        description,
        categoryId,
        type,
        spendingType,
        recurring = false,
        recurringFrequency,
        recurringStartDate,
        recurringEndDate,
        nextOccurrence
      } = transactionData;

      if (
        !amount ||
        !date ||
        !categoryId ||
        !type ||
        (type === 'expense' && !spendingType)
      ) {
        return res.status(400).json({
          message: 'All required fields are not provided for each transaction.'
        });
      }

      if (recurring && !recurringFrequency) {
        return res.status(400).json({
          message: 'Recurring frequency is required for recurring transactions.'
        });
      }

      // ✅ Resolve category
      let category = null;
      if (isValidObjectId(categoryId)) {
        const existingCategory = await Category.findById(categoryId);
        if (!existingCategory) {
          return res
            .status(400)
            .json({ message: `Invalid category ID: ${categoryId}` });
        }
        category = categoryId;
      } else {
        let existingCategoryByName = await Category.findOne({
          name: categoryId
        });
        if (!existingCategoryByName) {
          const newCategory = new Category({ name: categoryId, user: userId });
          existingCategoryByName = await newCategory.save();
        }
        category = existingCategoryByName._id;
      }

      // ✅ If recurring and both dates are provided — generate immediately
      if (recurring && recurringStartDate && recurringEndDate) {
        // ✅ Case 1: Generate all upfront
        const generatedDates = [];
        let next = new Date(recurringStartDate);
        const end = new Date(recurringEndDate);
        end.setHours(0, 0, 0, 0);

        while (next <= end) {
          generatedDates.push(new Date(next));

          switch (recurringFrequency) {
            case 'daily':
              next.setDate(next.getDate() + 1);
              break;
            case 'weekly':
              next.setDate(next.getDate() + 7);
              break;
            case 'monthly':
              next.setMonth(next.getMonth() + 1);
              break;
            case 'yearly':
              next.setFullYear(next.getFullYear() + 1);
              break;
          }
        }

        const batch = await Transaction.insertMany(
          generatedDates.map((date) => ({
            amount,
            date,
            description,
            type,
            category,
            user: userId,
            spendingType,
            recurring: true, // ✅ it's still part of recurring logic
            recurringFrequency,
            recurringStartDate,
            recurringEndDate,
            nextOccurrence: null // ✅ no cron follow-up needed
          }))
        );

        createdTransactions.push(...batch);
      } else {
        // ✅ Case 2: Open-ended — let cron job handle it
        const transaction = await Transaction.create({
          amount,
          date,
          description,
          type,
          category,
          user: userId,
          spendingType,
          recurring,
          recurringFrequency,
          recurringStartDate,
          recurringEndDate,
          nextOccurrence: recurring ? date : null
        });

        createdTransactions.push(transaction);
      }
    }

    return res.status(201).json({
      transactions: createdTransactions,
      message: 'Transactions added!'
    });
  } catch (error) {
    console.error('error', error);
    return res.status(500).json({ message: error.message });
  }
});
const getTransactions = async (req, res, type) => {
  try {
    const userId = req.user._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const category = req.query.category;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const sortBy = req.query.sortBy || 'date';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    const query = { user: userId, type };

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.category = new mongoose.Types.ObjectId(category);
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Fetch all user's transactions of this type (used for recurring grouping)
    const allUserTxns = await Transaction.find({
      user: userId,
      type
    }).lean();

    // Fetch paginated data only for display
    const paginated = await Transaction.find(query)
      .populate('category', 'name')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    // Enrich each with recurring info
    const enrichedTransactions = paginated.map((tx) => {
      const recurringDetails = calculateRecurringDetails(tx, allUserTxns);
      return {
        ...tx,
        recurringDetails: recurringDetails || undefined
      };
    });

    return res.status(200).json({
      transactions: enrichedTransactions,
      page,
      limit
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Income route
transactionRouter.get('/transaction/income', userAuth, (req, res) =>
  getTransactions(req, res, 'income')
);

// Expense route
transactionRouter.get('/transaction/expense', userAuth, (req, res) =>
  getTransactions(req, res, 'expense')
);

transactionRouter.put('/transaction/:id', userAuth, async (req, res) => {
  try {
    // ✅ Step 1: Authenticate user
    const userId = req.user._id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    // ✅ Step 2: Extract params & request body
    const transactionId = req.params.id;
    const {
      amount,
      category,
      description,
      date,
      type,
      spendingType,
      recurring,
      recurringFrequency,
      recurringStartDate,
      recurringEndDate,
      nextOccurrence
    } = req.body;

    // ✅ Step 3: Basic validation for required fields
    if (!amount || !category || !date || !type) {
      return res.status(400).json({
        message: 'Missing required fields: amount, category, date, or type.'
      });
    }

    // ✅ Step 4: If recurring is true, ensure frequency is present
    if (recurring === true && !recurringFrequency) {
      return res.status(400).json({
        message: 'Recurring frequency is required when recurring is enabled.'
      });
    }

    // ✅ Step 5: Normalize/resolve category
    let categoryId = null;
    if (isValidObjectId(category)) {
      const existingCategory = await Category.findById(category);
      if (!existingCategory) {
        return res.status(400).json({ message: 'Invalid category ID.' });
      }
      categoryId = category;
    } else {
      const existingCategoryByName = await Category.findOne({ name: category });
      if (!existingCategoryByName) {
        return res.status(400).json({
          message:
            'Category not found. Please provide a valid category ID or existing category name.'
        });
      }
      categoryId = existingCategoryByName._id;
    }

    // ✅ Step 6: Prepare fields to update
    const updateFields = {
      amount,
      category: categoryId,
      description,
      date,
      type,
      spendingType,
      recurring
    };

    // ✅ Step 7: Add/remove recurring-related fields
    if (recurring === true) {
      if (recurringFrequency)
        updateFields.recurringFrequency = recurringFrequency;
      if (recurringStartDate)
        updateFields.recurringStartDate = recurringStartDate;
      if (recurringEndDate) updateFields.recurringEndDate = recurringEndDate;
      if (nextOccurrence) updateFields.nextOccurrence = nextOccurrence;
    } else {
      // Clear all recurring fields if not recurring
      updateFields.recurringFrequency = null;
      updateFields.recurringStartDate = null;
      updateFields.recurringEndDate = null;
      updateFields.nextOccurrence = null;
    }

    // ✅ Step 8: Update transaction in DB
    const updatedTransaction = await Transaction.findOneAndUpdate(
      { _id: transactionId, user: userId },
      updateFields,
      { new: true }
    );

    if (!updatedTransaction) {
      return res.status(404).json({
        message: 'Transaction not found or does not belong to the user.'
      });
    }

    // ✅ Step 9: Respond with success
    return res.status(200).json({
      message: 'Transaction updated successfully.',
      transaction: updatedTransaction
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return res.status(500).json({
      message: 'Something went wrong while updating the transaction.',
      error: error.message
    });
  }
});

transactionRouter.delete('/transaction/:id', userAuth, async (req, res) => {
  try {
    const transactionId = req.params.id;
    if (!transactionId) {
      return res.status(400).json({ message: 'Transaction ID is required' });
    }

    // Ensure the user is authenticated
    const userId = req.user._id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Find and delete the transaction
    const transaction = await Transaction.findOneAndDelete({
      _id: transactionId,
      user: userId // Ensure user can delete only their transactions
    });

    if (!transaction) {
      return res
        .status(404)
        .json({ message: 'Transaction not found or unauthorized' });
    }

    return res
      .status(200)
      .json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
transactionRouter.get('/transaction/summary', userAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    // ✅ Get month from query params (e.g., "2024-03")
    const { month } = req.query;
    if (!month) {
      return res
        .status(400)
        .json({ message: 'Month is required in YYYY-MM format' });
    }

    const startDate = new Date(`${month}-01`);
    const endDate = new Date(`${month}-31`); // Covers the whole month

    // 🔹 Aggregate total income & expense for the selected month
    const summary = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
          }
        }
      }
    ]);

    const totalIncome = summary[0]?.totalIncome || 0;
    const totalExpense = summary[0]?.totalExpense || 0;
    const balance = totalIncome - totalExpense;

    // 🔹 Aggregate Needs, Wants, and Savings Breakdown
    const spendingBreakdown = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          type: 'expense',
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$spendingType',
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Convert spending breakdown into a structured object
    const needs =
      spendingBreakdown.find((item) => item._id === 'needs')?.total || 0;
    const wants =
      spendingBreakdown.find((item) => item._id === 'wants')?.total || 0;
    const savings =
      spendingBreakdown.find((item) => item._id === 'savings')?.total || 0;

    // 🔹 Calculate percentages
    const needsPercentage = totalIncome ? (needs / totalIncome) * 100 : 0;
    const wantsPercentage = totalIncome ? (wants / totalIncome) * 100 : 0;
    const savingsPercentage = totalIncome ? (savings / totalIncome) * 100 : 0;

    // 🔹 Warnings for Overspending
    let warnings = [];
    if (needsPercentage > 50)
      warnings.push(
        '⚠️ Needs spending is above 50% of income! Consider reducing fixed expenses.'
      );
    if (wantsPercentage > 30)
      warnings.push(
        '⚠️ Wants spending exceeds 30%! You may be overspending on non-essentials.'
      );
    if (savingsPercentage < 20)
      warnings.push(
        '⚠️ Savings is below 20%! Consider increasing your savings.'
      );

    // 🔹 Aggregate category-wise expenses for the selected month
    // const categoryBreakdown = await Transaction.aggregate([
    //   {
    //     $match: {
    //       user: new mongoose.Types.ObjectId(userId),
    //       type: "expense",
    //       date: { $gte: startDate, $lte: endDate }
    //     }
    //   },
    //   {
    //     $group: {
    //       _id: "$category",
    //       total: { $sum: "$amount" },
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: "categories",
    //       localField: "_id",
    //       foreignField: "_id",
    //       as: "categoryDetails",
    //     },
    //   },
    //   { $unwind: "$categoryDetails" },
    //   {
    //     $project: {
    //       _id: 0,
    //       categoryId: "$_id",
    //       categoryName: "$categoryDetails.name",
    //       total: 1,
    //     },
    //   },
    //   { $sort: { total: -1 } },
    // ]);

    return res.status(200).json({
      totalIncome,
      totalExpense,
      balance,
      needs,
      wants,
      savings,
      needsPercentage,
      wantsPercentage,
      savingsPercentage,
      warnings
      // categoryBreakdown
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

transactionRouter.get(
  '/transaction/top-categories',
  userAuth,
  async (req, res) => {
    try {
      const userId = req.user._id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const topCategories = await Transaction.aggregate([
        {
          $match: { user: new mongoose.Types.ObjectId(userId) }
        },
        {
          $group: {
            _id: {
              month: { $dateToString: { format: '%Y-%m', date: '$date' } },
              category: '$category'
            },
            totalExpense: { $sum: '$amount' }
          }
        },
        {
          $sort: { '_id.month': 1, totalExpense: -1 }
        },
        {
          $lookup: {
            from: 'categories', // Category collection name
            localField: '_id.category',
            foreignField: '_id',
            as: 'categoryDetails'
          }
        },
        {
          $unwind: '$categoryDetails'
        },
        {
          $group: {
            _id: '$_id.month',
            categories: {
              $push: {
                categoryId: '$_id.category',
                categoryName: '$categoryDetails.name',
                total: '$totalExpense'
              }
            }
          }
        },
        {
          $project: {
            month: '$_id',
            categories: { $slice: ['$categories', 3] }, // ✅ Limit to top 3 categories per month
            _id: 0
          }
        }
      ]);

      console.log(topCategories);

      return res.status(200).json({ topCategories });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);
transactionRouter.get('/transaction/trends', userAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const trends = await Transaction.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          totalExpense: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } } // Sorting by month
    ]);

    return res.status(200).json({ trends });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
transactionRouter.get(
  '/transaction/recent-income',
  userAuth,
  async (req, res) => {
    try {
      const userId = req.user._id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const recentIncome = await Transaction.find({
        user: userId,
        type: 'income',
        $or: [{ recurring: { $ne: true } }, { date: { $lte: new Date() } }]
      })
        .populate('category', 'name')
        .sort({ date: -1 })
        .limit(3)
        .select('amount date description category type recurring');

      return res.status(200).json({ recentIncome });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

transactionRouter.get(
  '/transaction/recent-expenses',
  userAuth,
  async (req, res) => {
    try {
      const userId = req.user._id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const recentExpenses = await Transaction.find({
        user: userId,
        type: 'expense',
        $or: [{ recurring: { $ne: true } }, { date: { $lte: new Date() } }]
      })
        .populate('category', 'name')
        .sort({ date: -1 })
        .limit(3)
        .select('amount date description category type spendingType recurring');

      return res.status(200).json({ recentExpenses });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

module.exports = transactionRouter;
