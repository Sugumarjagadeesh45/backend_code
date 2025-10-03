const express = require('express');
const multer = require('multer');
const path = require('path'); // Added missing import

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

const { getProducts, addProduct, updateProduct, deleteProduct, deleteSelectedProducts } = require('../controllers/groceryController');


const router = express.Router();

router.get('/groceries', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', getProducts);
router.post('/',  upload.array('images', 5), addProduct);
router.put('/:id',  upload.array('images', 5), updateProduct);
router.delete('/:id',  deleteProduct);
router.post('/delete-selected',  deleteSelectedProducts);

// Add this to your groceryRoutes.js
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});


module.exports = router;

// const express = require('express');
// const jwt = require('jsonwebtoken');
// const {
//   getGroceryItems,
//   addGroceryItem,
//   updateGroceryItem,
//   deleteGroceryItem,
//   redeemGroceryItem
// } = require('../controllers/groceryController');

// const router = express.Router();

// // Auth middleware
// function auth(req, res, next) {
//   const header = req.headers.authorization;
//   if (!header) return res.status(401).json({ error: 'No token' });
//   const token = header.split(' ')[1];
//   try {
//     const data = jwt.verify(token, process.env.JWT_SECRET || 'secret');
//     req.user = data;
//     return next();
//   } catch (err) {
//     return res.status(401).json({ error: 'Invalid token' });
//   }
// }

// // Routes
// router.get('/items', getGroceryItems);
// router.post('/items', addGroceryItem);
// router.put('/items/:id', updateGroceryItem);
// router.delete('/items/:id', deleteGroceryItem);
// router.post('/redeem/:itemId', auth, redeemGroceryItem);

// module.exports = router;
