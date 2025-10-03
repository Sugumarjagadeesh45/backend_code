const mongoose = require('mongoose');

const grocerySchema = new mongoose.Schema({
  name: { type: String, required: true },
  pointsPrice: { type: Number, required: true }, // cost in points
  stock: { type: Number, default: 0 },
  category: { type: String }, // Optional: fruits, dairy, etc.
  imageUrl: { type: String }, // Optional: for frontend display
  unit: { type: String }, // e.g., "1kg", "1L", "500g"
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('GroceryItem', grocerySchema);
