
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const multer = require('multer');
const path = require('path');

// Multer Setup for Profile Picture Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// PUBLIC ROUTES (No Auth Required)
router.post('/register', userController.registerUser);
router.get('/test', (req, res) => res.json({ message: 'User routes are working!' }));

// PROTECTED ROUTES (Require Auth)
router.use(userController.authMiddleware);

// Ride Routes
router.post('/book-ride', userController.bookRide);
router.get('/ride-history', userController.getRideHistory);
router.post('/ride', userController.createRide);
router.put('/ride/status', userController.updateRideStatus);

router.put('/profile', upload.single('profilePicture'), userController.updateProfile);

// Profile Routes
router.get('/me/profile', userController.getCurrentUserProfile);
router.get('/me', userController.getProfile);
router.get('/profile', userController.getProfile);
router.put('/profile', upload.single('profilePicture'), userController.updateProfile);

// Wallet Routes
router.get('/wallet', userController.getWallet);
router.post('/wallet/add', userController.addToWallet);
router.post('/wallet/deduct', userController.deductFromWallet);

// Location Routes
router.post('/location', userController.saveUserLocation);
router.get('/location/last', userController.getLastUserLocation);
router.get('/location/all', userController.getAllUserLocations);
router.get('/last-location', userController.getLastUserLocation);
router.get('/all-locations', userController.getAllUserLocations);
router.post('/save-location', userController.saveUserLocation);




// User Management (for admin or internal tools)
router.get('/registered', userController.getAllRegisteredUsers);
router.get('/registered/:id', userController.getRegisteredUserById);
router.get('/', userController.getUsers);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;