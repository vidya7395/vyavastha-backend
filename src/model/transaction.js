const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define the schema for Transaction
const TransactionSchema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    spendingType: { 
        type: String, 
        enum: ["needs", "wants", "savings"], 
        required: function () { return this.type === "expense"; } // Only required for expenses
      },
    description: { type: String },
    date: { type: Date, default: Date.now }
    
}, { timestamps: true });

// Create or retrieve the model
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;