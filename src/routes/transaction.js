const express = require('express');
const Transaction = require('../model/transaction');
const Category = require('../model/category');
const { userAuth } = require('../middlewares/auth');
const { default: mongoose, isValidObjectId } = require('mongoose');
const {
  calculateRecurringDetails,
  generateRecurringDates,
  updateRecurringDetails
} = require('../utils/recurring');
const recurringTransaction = require('../model/recurringTransaction');
const transaction = require('../model/transaction');
const { default: axios } = require('axios');
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
    const userId = req.user._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const transactions = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res
        .status(400)
        .json({ message: 'Provide at least one transaction.' });
    }

    const createdTransactions = [];

    for (const tx of transactions) {
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
        recurringEndDate
      } = tx;

      if (
        !amount ||
        !date ||
        !categoryId ||
        !type ||
        (type === 'expense' && !spendingType)
      ) {
        return res.status(400).json({ message: 'Missing required fields.' });
      }

      // Step 1: Resolve category
      let category = null;
      if (isValidObjectId(categoryId)) {
        const found = await Category.findById(categoryId);
        if (!found)
          return res.status(400).json({ message: 'Invalid category ID.' });
        category = found._id;
      } else {
        let existing = await Category.findOne({ name: categoryId });
        if (!existing) {
          existing = await new Category({
            name: categoryId,
            user: userId
          }).save();
        }
        category = existing._id;
      }

      // Step 2: Handle recurring logic
      if (recurring) {
        // 🔥 Step 2a: Create RecurringTransaction
        const recurringDoc = await recurringTransaction.create({
          user: userId,
          amount,
          description,
          type,
          spendingType,
          category,
          recurringFrequency,
          recurringStartDate: new Date(recurringStartDate || date),
          recurringEndDate: recurringEndDate
            ? new Date(recurringEndDate)
            : null,
          lastGeneratedDate: null
        });

        // 🔁 Step 2b: Generate dates
        let occurrences = [];
        if (recurringEndDate) {
          occurrences = generateRecurringDates(
            recurringStartDate,
            recurringEndDate,
            recurringFrequency
          );
        } else {
          occurrences = [new Date(recurringStartDate || date)];
        }

        // Step 2c: Save child transactions
        const batch = occurrences.map((d, i) => ({
          user: userId,
          amount,
          description,
          type,
          spendingType,
          category,
          date: new Date(d),
          recurring: true,
          nextOccurrence: occurrences[i + 1]
            ? new Date(occurrences[i + 1])
            : null,
          recurringGroupId: recurringDoc._id
        }));

        try {
          const inserted = await transaction.insertMany(batch);
          createdTransactions.push(...inserted);
        } catch (insertErr) {
          console.error('InsertMany failed:', insertErr);
        }
      }

      // Step 3: Non-recurring
      else {
        const transaction = await Transaction.create({
          user: userId,
          amount,
          description,
          type,
          spendingType,
          category,
          date: new Date(date),
          recurring: false
        });
        createdTransactions.push(transaction);
      }
    }

    return res.status(201).json({
      transactions: createdTransactions,
      message: 'Transactions added!'
    });
  } catch (err) {
    console.error('Add transaction error:', err);
    return res.status(500).json({ message: err.message });
  }
});
const getTransactions = async (req, res, type = null) => {
  try {
    const userId = req.user.id;
    const today = new Date();

    const showFuture = req.query.future === 'true';
    const showAll = req.query.all === 'true';

    let filter = {
      user: userId
    };

    let allTransactionFilter = {
      user: userId
    };
    // Optional type filter ('income' or 'expense')
    if (type) {
      filter.type = type.toLowerCase(); // normalize
      allTransactionFilter.type = type.toLowerCase();
    }

    // Apply date filters
    if (!showAll) {
      filter.date = showFuture ? { $gt: today } : { $lte: today };
    }

    let transactions = await Transaction.find(filter)
      .sort({ date: -1 }) // latest first
      .populate('recurringGroupId')
      .populate('category')
      .lean();

    let allTransactions = await Transaction.find(allTransactionFilter)
      .sort({ date: -1 }) // latest first
      .populate('recurringGroupId')
      .populate('category')
      .lean();

    transactions = transactions.map((tx) => {
      if (tx.recurring) {
        tx.recurringDetails = calculateRecurringDetails(tx, allTransactions);
      }
      return tx;
    });
    res.status(200).json({
      transactions,
      page: 1,
      limit: 10
    });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res
      .status(500)
      .json({ message: 'Something went wrong while fetching transactions.' });
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

    const { month } = req.query;
    if (!month) {
      return res
        .status(400)
        .json({ message: 'Month is required in YYYY-MM format' });
    }

    const startDate = new Date(`${month}-01`);
    const endDate = new Date(`${month}-31`);

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

    const needs = spendingBreakdown.find((b) => b._id === 'needs')?.total || 0;
    const wants = spendingBreakdown.find((b) => b._id === 'wants')?.total || 0;
    const savings =
      spendingBreakdown.find((b) => b._id === 'savings')?.total || 0;

    const spendingMap = { needs, wants, savings };

    const analyze = (actualPercent, idealPercent, type) => {
      const diff = actualPercent - idealPercent;
      let status = 'ok';
      let suggestion = '';
      const actual = type === 'savings' ? savings : spendingMap[type] || 0;
      const ideal = (totalIncome * idealPercent) / 100;

      if (type === 'savings') {
        if (actualPercent < 20) {
          status = 'under';
          suggestion = 'Try to save at least 20% of your income.';
        } else if (actualPercent <= 30) {
          status = 'great';
          suggestion =
            '👏 You’re doing well on savings. Keep building that buffer!';
        } else {
          status = 'excellent';
          suggestion =
            '🚀 Excellent savings rate! This gives you a lot of financial flexibility.';
        }
      } else {
        if (actualPercent === 0) {
          status = 'ok';
          suggestion = `🎯 Perfect control on your ${type} spending.`;
        } else if (actualPercent <= idealPercent) {
          status = 'ok';
          suggestion = `✅ Great job managing your ${type} spending!`;
        } else if (actualPercent <= idealPercent + 10) {
          status = 'caution';
          suggestion = `⚠️ You’re slightly over your ${type} budget. Try trimming it.`;
        } else {
          status = 'over';
          suggestion = `🚫 Overspending on ${type}. Time to review and cut back.`;
        }
      }

      return {
        status,
        percentage: parseFloat(actualPercent.toFixed(2)),
        actual: parseFloat(actual.toFixed(2)),
        ideal: parseFloat(ideal.toFixed(2)),
        difference: parseFloat(diff.toFixed(2)),
        suggestion
      };
    };

    const needsAnalysis = analyze((needs / totalIncome) * 100, 50, 'needs');
    const wantsAnalysis = analyze((wants / totalIncome) * 100, 30, 'wants');
    const savingsAnalysis = analyze(
      (savings / totalIncome) * 100,
      20,
      'savings'
    );

    let aiInsight = null;

    try {
      const prompt = `
User's monthly income: ₹${totalIncome}
Total expense: ₹${totalExpense}
Balance: ₹${balance}

Spending breakdown:
- Needs: ₹${needsAnalysis.actual} (${needsAnalysis.percentage}%)
- Wants: ₹${wantsAnalysis.actual} (${wantsAnalysis.percentage}%)
- Savings: ₹${savingsAnalysis.actual} (${savingsAnalysis.percentage}%)

You are a helpful, witty financial coach.

Give  actionable financial tip to reduce spending or improve savings. Use simple English.
 Just give a friendly, realistic suggestion and also funny.
 make it in a way that user likes to read it, not very big that user lose his interest, like important stuff only

`;

      const aiResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a smart financial assistant.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      aiInsight = aiResponse.data.choices[0].message.content.trim();
    } catch (err) {
      console.warn('⚠️ AI insight generation failed:', err.message);
      // No need to block response — we fallback to normal data
    }

    // ✅ Final response: AI insight is optional
    const responsePayload = {
      totalIncome,
      totalExpense,
      balance,
      breakdown: {
        needs: needsAnalysis,
        wants: wantsAnalysis,
        savings: savingsAnalysis
      }
    };

    if (aiInsight) {
      responsePayload.aiInsight = aiInsight;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Summary API Error:', error);
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
