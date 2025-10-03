// controllers/adminController.js


const User = require('../models/User');
const Driver = require('../models/driver/driver');
const Ride = require('../models/ride');
const GroceryItem = require('../models/groceryItem');






exports.getDashboardData = async (req, res) => {
  try {
    const activeRiders = await Ride.countDocuments({ status: 'ongoing' }); // Riders with ongoing rides
    const activeDrivers = await Driver.countDocuments({ online: true }); // Online drivers
    const pendingRides = await Ride.countDocuments({ status: 'requested' }); // Rides pending acceptance
    const pointsRedeemed = await User.aggregate([
      { $unwind: "$wallet" },
      { $group: { _id: null, totalPoints: { $sum: "$wallet.points" } } }
    ]);

    res.json({
      activeRiders,
      activeDrivers,
      pendingRides,
      pointsRedeemed: `₹${pointsRedeemed[0]?.totalPoints || 0}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all drivers
exports.getDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Toggle driver online/offline
exports.toggleDriverStatus = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    driver.online = !driver.online;
    await driver.save();
    res.json({ message: 'Driver status updated', driver });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all rides
exports.getRides = async (req, res) => {
  try {
    const rides = await Ride.find()
      .populate('user', 'name phone')
      .populate('driver', 'name phone vehicleType')
      .sort({ createdAt: -1 });
    res.json(rides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Assign a driver to a ride
exports.assignRide = async (req, res) => {
  try {
    const { driverId } = req.body;
    const ride = await Ride.findById(req.params.rideId);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    ride.driver = driverId;
    ride.status = 'accepted';
    await ride.save();

    res.json({ message: 'Driver assigned to ride', ride });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Adjust user points
exports.adjustUserPoints = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.wallet.points += amount;
    if (user.wallet.points < 0) user.wallet.points = 0;
    await user.save();

    res.json({ message: 'Points updated', wallet: user.wallet });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Adjust grocery stock
exports.adjustGroceryStock = async (req, res) => {
  try {
    const { itemId, change } = req.body;
    const item = await GroceryItem.findById(itemId);
    if (!item) return res.status(404).json({ message: 'Grocery item not found' });

    item.stock += change;
    if (item.stock < 0) item.stock = 0;
    await item.save();

    res.json({ message: 'Stock updated', grocery: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
