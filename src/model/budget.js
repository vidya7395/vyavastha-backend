const mongoose = require("mongoose");
const { Schema } = mongoose;

const BudgetSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true, lowercase: true, trim: true },
    amount: { type: Number, required: true },
    month: { type: String, required: true }, // Example: "2024-02" (YYYY-MM)
  },
  { timestamps: true }
);

module.exports = mongoose.models.Budget || mongoose.model("Budget", BudgetSchema);