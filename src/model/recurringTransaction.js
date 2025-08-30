// models/RecurringTransaction.js
const mongoose = require('mongoose');

const recurringTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: Number,
    description: String,
    type: { type: String, enum: ['income', 'expense'], required: true },
    spendingType: { type: String, enum: ['needs', 'wants', 'savings'] },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    recurringFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      required: true
    },
    recurringStartDate: { type: Date, required: true },
    recurringEndDate: { type: Date, default: null },
    lastGeneratedDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled'],
      default: 'active'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'RecurringTransaction',
  recurringTransactionSchema
);
