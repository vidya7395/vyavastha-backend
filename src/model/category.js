const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, lowercase: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // User-specific categories
  },
  { timestamps: true }
);

const Category = mongoose.models.Category || mongoose.model("Category", categorySchema);
module.exports = Category;