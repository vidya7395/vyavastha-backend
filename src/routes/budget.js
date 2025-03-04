const { userAuth } = require("../middlewares/auth");
const express = require("express");
const Budget = require("../model/budget");
const { default: mongoose } = require("mongoose");
const Transaction = require("../model/transaction");

const budgetRouter = express.Router();
budgetRouter.get("/budget",userAuth,async(req,res)=>{
    try {
        const userId = req.user._id;
        const budgets = await Budget.find({ user: userId }).sort({ month: -1 });
        return res.status(200).json({ budgets });
      } catch (error) {
        log
        return res.status(500).json({ message: error.message });
      }
})
budgetRouter.post('/budget', userAuth,async (req, res) => {
    try {
        const userId = req.user._id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
  
      const { category, amount, month } = req.body;
      if (!category || !amount || !month) {
        return res.status(400).json({ message: 'All fields are required' });
      }
  
      const newBudget = new Budget({ user: userId, category, amount, month });
      await newBudget.save();
  
      return res.status(201).json({ message: 'Budget added successfully', budget: newBudget });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });
  
  // ✅ PUT Budget (Update an existing budget)
budgetRouter.put('/budget', userAuth,async (req, res) => {
    try {
        const userId = req.user._id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
  
      const { id, category, amount, month } = req.body;
      if (!id) {
        return res.status(400).json({ message: 'Budget ID is required' });
      }
  
      const updatedBudget = await Budget.findOneAndUpdate(
        { _id: id, user: userId },
        { category, amount, month },
        { new: true }
      );
  
      if (!updatedBudget) {
        return res.status(404).json({ message: 'Budget not found or unauthorized' });
      }
  
      return res.status(200).json({ message: 'Budget updated', budget: updatedBudget });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });
  
  // ✅ DELETE Budget (Remove a budget entry)
budgetRouter.delete('/budget', userAuth,async (req, res) => {
    try {
      const userId = req.user._id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
  
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ message: 'Budget ID is required' });
      }
  
      const deletedBudget = await Budget.findOneAndDelete({ _id: id, user: userId });
  
      if (!deletedBudget) {
        return res.status(404).json({ message: 'Budget not found or unauthorized' });
      }
  
      return res.status(200).json({ message: 'Budget deleted successfully' });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });


  budgetRouter.get('/budget/summary', userAuth,async (req, res) => {
    try {
        const userId = req.user._id;
    
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }
    
        // Get the current month (YYYY-MM format)
        const currentMonth = new Date().toISOString().slice(0, 7);
    
        // Fetch budgets for the current month
        const budgets = await Budget.find({ user: new mongoose.Types.ObjectId(userId), month: currentMonth });
    
        // Fetch expenses for the current month
        const transactions = await Transaction.aggregate([
          {
            $match: {
              user: new mongoose.Types.ObjectId(userId),
              date: { $gte: new Date(`${currentMonth}-01`), $lte: new Date(`${currentMonth}-31`) }
            }
          },
          {
            $group: {
              _id: "$category",
              totalSpent: { $sum: "$amount" }
            }
          }
        ]);
    
        // Convert transactions into a map { category: totalSpent }
        const expenseMap = transactions.reduce((acc, item) => {
          acc[item._id] = item.totalSpent;
          return acc;
        }, {});
    
        // Calculate the summary
        const summary = budgets.map(budget => ({
          category: budget.category,
          budgetedAmount: budget.amount,
          actualSpent: expenseMap[budget.category] || 0,
          remainingBudget: budget.amount - (expenseMap[budget.category] || 0)
        }));
    
        return res.status(200).json({ summary, month: currentMonth });
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
  });
module.exports = budgetRouter;
