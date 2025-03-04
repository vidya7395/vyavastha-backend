const { userAuth } = require("../middlewares/auth");
const express = require("express");
const Category = require("../model/category");
const categoryRouter = express.Router();

categoryRouter.get('/categories', userAuth,async (req, res) => {
    try {
      const userId = req.user._id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
      const categories = await Category.find({ user: userId });
      return res.status(200).json({ categories });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });
  
  // ✅ POST: Add a new category
  categoryRouter.post('/categories', userAuth,async (req, res) => {
    try {
      const userId = req.user._id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: 'Category name is required' });
  
      const category = await Category.create({ name, user: userId });
      return res.status(201).json({ category, message: 'Category added!' });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });
  module.exports = categoryRouter