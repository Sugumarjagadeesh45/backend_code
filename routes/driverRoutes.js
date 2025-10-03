// routes/driverRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Driver = require("../models/driver/driver"); // make sure path is correct
const driverController = require("../controllers/driver/driverController");
const auth = require("../middleware/authMiddleware");
router.post("/login", driverController.loginDriver);
router.get("/login", driverController.loginDriver);

// Change password
router.post("/change-password", driverController.changePassword);

// Create test driver (for testing purpose)
router.post("/create-test-driver", async (req, res) => {
  try {
    const { driverId, name, phone, password } = req.body;

    // Check if driver already exists
    const existingDriver = await Driver.findOne({ driverId });
    if (existingDriver) {
      return res.status(400).json({ msg: "Driver already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create new driver
    const driver = new Driver({
      driverId,
      name,
      phone,
      passwordHash,
      status: "Offline",
      vehicleType: "taxi",
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
    });

    await driver.save();

    res.status(201).json({
      success: true,
      msg: "Test driver created successfully",
      driver: {
        driverId: driver.driverId,
        name: driver.name,
        phone: driver.phone,
      },
    });
  } catch (error) {
    console.error("Error creating test driver:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// PROTECTED ROUTES
// =====================

// Apply auth middleware to all routes below
router.use(auth);

// Update driver location
router.post("/update-location", driverController.updateLocation);

// Get nearby drivers
router.get("/nearby", async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ msg: "Latitude and longitude required" });
    }

    const drivers = await Driver.find({
      status: "Live",
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: 2000, // 2 km
        },
      },
    }).select("driverId name location vehicleType");

    res.json({
      success: true,
      count: drivers.length,
      drivers,
    });
  } catch (err) {
    console.error("❌ Error in getNearbyDrivers:", err);
    res.status(500).json({ error: err.message });
  }
});

// Ride management
router.get("/rides/:rideId", driverController.getRideById);
router.put("/rides/:rideId", driverController.updateRideStatus);

// Driver management
router.get("/", driverController.getDrivers);
router.get("/nearest", driverController.getNearestDrivers);
router.put("/:driverId", driverController.updateDriver);
router.delete("/:driverId", driverController.deleteDriver);
router.post("/logout", driverController.logoutDriver);

module.exports = router;





// const express = require('express');
// const router = express.Router();
// const driverController = require('../controllers/driver/driverController');
// const auth = require('../middleware/authMiddleware');

// // Public routes
// router.post('/login', driverController.loginDriver);
// router.post('/change-password', driverController.changePassword);

// // Protected routes (require authentication)
// router.use(auth); // Apply auth middleware to all routes below

// // Location update
// router.post('/update-location', driverController.updateLocation);





// // Add to your driverRoutes.js
// // Add this to your driverRoutes.js or create a test endpoint
// router.post('/create-test-driver', async (req, res) => {
//   try {
//     const { driverId, name, phone, password } = req.body;
    
//     // Check if driver already exists
//     const existingDriver = await Driver.findOne({ driverId });
//     if (existingDriver) {
//       return res.status(400).json({ msg: "Driver already exists" });
//     }
    
//     // Create new driver
//     const bcrypt = require('bcryptjs');
//     const passwordHash = await bcrypt.hash(password, 10);
    
//     const driver = new Driver({
//       driverId,
//       name,
//       phone,
//       passwordHash,
//       status: "Offline",
//       vehicleType: "taxi",
//       location: {
//         type: "Point",
//         coordinates: [0, 0]
//       }
//     });
    
//     await driver.save();
    
//     res.status(201).json({
//       success: true,
//       msg: "Test driver created successfully",
//       driver: {
//         driverId: driver.driverId,
//         name: driver.name,
//         phone: driver.phone
//       }
//     });
//   } catch (error) {
//     console.error("Error creating test driver:", error);
//     res.status(500).json({ error: error.message });
//   }
// });


// // Add to existing driverRoutes.js
// router.get('/nearby', async (req, res) => {
//   try {
//     const { latitude, longitude } = req.query;

//     if (!latitude || !longitude) {
//       return res.status(400).json({ msg: "Latitude and longitude required" });
//     }

//     const drivers = await Driver.find({
//       status: "Live",
//       location: {
//         $near: {
//           $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
//           $maxDistance: 2000, // 2km radius
//         },
//       },
//     }).select("driverId name location vehicleType");

//     res.json({
//       success: true,
//       count: drivers.length,
//       drivers,
//     });
//   } catch (err) {
//     console.error("❌ Error in getNearbyDrivers:", err);
//     res.status(500).json({ error: err.message });
//   }
// });




// // Ride management
// router.get('/rides/:rideId', driverController.getRideById);
// router.put('/rides/:rideId', driverController.updateRideStatus); // This is the important one

// // Driver management
// router.get('/', driverController.getDrivers);
// router.get('/nearest', driverController.getNearestDrivers);
// router.put('/:driverId', driverController.updateDriver);
// router.delete('/:driverId', driverController.deleteDriver);
// router.post('/logout', driverController.logoutDriver);

// module.exports = router;

