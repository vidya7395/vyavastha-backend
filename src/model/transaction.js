const mongoose = require('mongoose');
const { Schema } = mongoose;

const TransactionSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    type: { type: String, enum: ['income', 'expense'], required: true },
    spendingType: {
      type: String,
      enum: ['needs', 'wants', 'savings'],
      required: function () {
        return this.type === 'expense';
      }
    },
    description: { type: String },
    date: { type: Date, default: Date.now },

    // 🆕 Recurring fields
    recurring: {
      type: Boolean,
      default: false
    },
    recurringFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      required: function () {
        return this.recurring;
      }
    },
    nextOccurrence: {
      type: Date
    },
    recurringStartDate: {
      type: Date,
      default: Date.now
    },
    recurringEndDate: {
      type: Date // optional
    }
  },
  { timestamps: true }
);

const Transaction =
  mongoose.models.Transaction ||
  mongoose.model('Transaction', TransactionSchema);
module.exports = Transaction;
