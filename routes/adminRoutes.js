// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// ================================
// Direct In-Memory Status Routes
// ================================

// Get current driver status
router.get('/driver-status', (req, res) => {
  try {
    const drivers = Array.from(activeDriverSockets.values()).map(driver => ({
      driverId: driver.driverId,
      driverName: driver.driverName,
      status: driver.status,
      vehicleType: driver.vehicleType,
      location: driver.location,
      lastUpdate: driver.lastUpdate,
      socketId: driver.socketId
    }));

    res.json({
      totalDrivers: drivers.length,
      drivers: drivers
    });
  } catch (err) {
    console.error('Error fetching driver status:', err);
    res.status(500).json({ error: 'Failed to fetch driver status' });
  }
});

// Get current ride status
router.get('/ride-status', (req, res) => {
  try {
    const ridesList = Object.entries(rides).map(([rideId, ride]) => ({
      rideId,
      status: ride.status,
      userId: ride.userId,
      driverId: ride.driverId,
      driverName: ride.driverName,
      pickup: ride.pickup,
      drop: ride.drop,
      vehicleType: ride.vehicleType,
      timestamp: ride.timestamp,
      acceptedAt: ride.acceptedAt,
      completedAt: ride.completedAt
    }));

    res.json({
      totalRides: ridesList.length,
      rides: ridesList
    });
  } catch (err) {
    console.error('Error fetching ride status:', err);
    res.status(500).json({ error: 'Failed to fetch ride status' });
  }
});

// ================================
// Admin Controller Routes
// ================================

// User & Driver Management
router.get('/dashboard-data', adminController.getDashboardData);
router.get('/users', adminController.getUsers);
router.get('/drivers', adminController.getDrivers);
router.put('/driver/:id/toggle', adminController.toggleDriverStatus);

// Rides
router.get('/rides', adminController.getRides);
router.post('/ride/:rideId/assign', adminController.assignRide);

// Points & Stock
router.post('/user/:id/adjust-points', adminController.adjustUserPoints);
router.post('/grocery/adjust-stock', adminController.adjustGroceryStock);

module.exports = router;











// // routes/adminRoutes.js
// const express = require('express');
// const router = express.Router();
// const adminController = require('../controllers/adminController');

// // User & Driver Management
// router.get('/dashboard-data', adminController.getDashboardData);
// router.get('/users', adminController.getUsers);
// router.get('/drivers', adminController.getDrivers);
// router.put('/driver/:id/toggle', adminController.toggleDriverStatus);

// // Rides
// router.get('/rides', adminController.getRides);
// router.post('/ride/:rideId/assign', adminController.assignRide);

// // Points & Stock
// router.post('/user/:id/adjust-points', adminController.adjustUserPoints);
// router.post('/grocery/adjust-stock', adminController.adjustGroceryStock);

// module.exports = router;
