const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },

    recurringGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecurringTransaction',
      default: null
    },

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

    // Only these two recurring fields are needed
    recurring: { type: Boolean, default: false },
    nextOccurrence: { type: Date } // Optional: used for future views
  },
  { timestamps: true }
);
module.exports = mongoose.model('transaction', TransactionSchema);
// module.exports = mongoose.model('Transaction', TransactionSchema);
