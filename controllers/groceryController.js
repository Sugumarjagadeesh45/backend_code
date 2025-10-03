const Product = require('../models/Product');


const getProducts = async (req, res) => {
  const { category } = req.query;
  try {
    let query = {};
    if (category && category !== 'All') query.category = category;
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

const addProduct = async (req, res) => {
  const { name, description, price, originalPrice, discount, category } = req.body;
  const files = req.files;
  try {
    const images = files ? files.map(file => `/uploads/${file.filename}`) : [];
    const product = new Product({ name, description, price: parseFloat(price), originalPrice: parseFloat(originalPrice), discount: parseFloat(discount), category, images });
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, description, price, originalPrice, discount, category } = req.body;
  const files = req.files;
  try {
    const updateData = { name, description, price: parseFloat(price), originalPrice: parseFloat(originalPrice), discount: parseFloat(discount), category, createdAt: new Date() };
    if (files && files.length > 0) {
      updateData.images = files.map(file => `/uploads/${file.filename}`);
    }
    const product = await Product.findByIdAndUpdate(id, updateData, { new: true });
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    await Product.findByIdAndDelete(id);
    res.json({ msg: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

const deleteSelectedProducts = async (req, res) => {
  const { ids } = req.body;
  try {
    await Product.deleteMany({ _id: { $in: ids } });
    res.json({ msg: 'Selected products deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = { getProducts, addProduct, updateProduct, deleteProduct, deleteSelectedProducts };

// const GroceryItem = require('../models/groceryItem');
// const User = require('../models/User');

// // Get all grocery items
// exports.getGroceryItems = async (req, res) => {
//   try {
//     const items = await GroceryItem.find();
//     res.json(items);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // Add grocery item
// exports.addGroceryItem = async (req, res) => {
//   try {
//     const { name, pointsPrice, stock } = req.body;
//     const item = await GroceryItem.create({ name, pointsPrice, stock });
//     res.status(201).json(item);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };

// // Update grocery item
// exports.updateGroceryItem = async (req, res) => {
//   try {
//     const item = await GroceryItem.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true }
//     );
//     res.json(item);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };

// // Delete grocery item
// exports.deleteGroceryItem = async (req, res) => {
//   try {
//     await GroceryItem.findByIdAndDelete(req.params.id);
//     res.json({ message: 'Grocery item deleted successfully' });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // Redeem grocery item
// exports.redeemGroceryItem = async (req, res) => {
//   try {
//     const item = await GroceryItem.findById(req.params.itemId);
//     if (!item) return res.status(404).json({ error: 'Item not found' });
//     if (item.stock <= 0) return res.status(400).json({ error: 'Out of stock' });

//     const user = await User.findById(req.user.id);
//     if (user.wallet.points < item.pointsPrice) {
//       return res.status(400).json({ error: 'Insufficient points' });
//     }

//     // Deduct points & stock
//     user.wallet.points -= item.pointsPrice;
//     await user.save();

//     item.stock -= 1;
//     await item.save();

//     res.json({ message: 'Redeemed successfully', remainingPoints: user.wallet.points });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };
