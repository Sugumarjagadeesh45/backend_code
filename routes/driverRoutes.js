const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Driver = require("../models/driver/driver");
const driverController = require("../controllers/driver/driverController");
const auth = require("../middleware/authMiddleware");

router.post("/login", driverController.loginDriver);
router.get("/login", driverController.loginDriver);
router.post("/change-password", driverController.changePassword);
router.post("/create-test-driver", async (req, res) => {
  try {
    const { driverId, name, phone, password } = req.body;
    const existingDriver = await Driver.findOne({ driverId });
    if (existingDriver) {
      return res.status(400).json({ msg: "Driver already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
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

// Token verification endpoint
router.get("/verify", auth, async (req, res) => {
  try {
    const driver = await Driver.findOne({ driverId: req.user.driverId });
    if (!driver) {
      return res.status(404).json({ msg: "Driver not found" });
    }
    res.json({ driverId: driver.driverId, name: driver.name });
  } catch (err) {
    console.error("❌ Error in verifyDriver:", err);
    res.status(500).json({ error: err.message });
  }
});

router.use(auth);
router.post("/update-location", driverController.updateLocation);
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
          $maxDistance: 2000,
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
router.get("/rides/:rideId", driverController.getRideById);
router.put("/rides/:rideId", driverController.updateRideStatus);
router.get("/", driverController.getDrivers);
router.get("/nearest", driverController.getNearestDrivers);
router.put("/:driverId", driverController.updateDriver);
router.delete("/:driverId", driverController.deleteDriver);
router.post("/logout", driverController.logoutDriver);

module.exports = router;










// // routes/driverRoutes.js
// const express = require("express");
// const router = express.Router();
// const bcrypt = require("bcryptjs");
// const Driver = require("../models/driver/driver"); // make sure path is correct
// const driverController = require("../controllers/driver/driverController");
// const auth = require("../middleware/authMiddleware");
// router.post("/login", driverController.loginDriver);
// router.get("/login", driverController.loginDriver);

// // Change password
// router.post("/change-password", driverController.changePassword);

// // Create test driver (for testing purpose)
// router.post("/create-test-driver", async (req, res) => {
//   try {
//     const { driverId, name, phone, password } = req.body;

//     // Check if driver already exists
//     const existingDriver = await Driver.findOne({ driverId });
//     if (existingDriver) {
//       return res.status(400).json({ msg: "Driver already exists" });
//     }

//     // Hash password
//     const passwordHash = await bcrypt.hash(password, 10);

//     // Create new driver
//     const driver = new Driver({
//       driverId,
//       name,
//       phone,
//       passwordHash,
//       status: "Offline",
//       vehicleType: "taxi",
//       location: {
//         type: "Point",
//         coordinates: [0, 0],
//       },
//     });

//     await driver.save();

//     res.status(201).json({
//       success: true,
//       msg: "Test driver created successfully",
//       driver: {
//         driverId: driver.driverId,
//         name: driver.name,
//         phone: driver.phone,
//       },
//     });
//   } catch (error) {
//     console.error("Error creating test driver:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // =====================
// // PROTECTED ROUTES
// // =====================

// // Apply auth middleware to all routes below
// router.use(auth);

// // Update driver location
// router.post("/update-location", driverController.updateLocation);

// // Get nearby drivers
// router.get("/nearby", async (req, res) => {
//   try {
//     const { latitude, longitude } = req.query;

//     if (!latitude || !longitude) {
//       return res.status(400).json({ msg: "Latitude and longitude required" });
//     }

//     const drivers = await Driver.find({
//       status: "Live",
//       location: {
//         $near: {
//           $geometry: {
//             type: "Point",
//             coordinates: [parseFloat(longitude), parseFloat(latitude)],
//           },
//           $maxDistance: 2000, // 2 km
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
// router.get("/rides/:rideId", driverController.getRideById);
// router.put("/rides/:rideId", driverController.updateRideStatus);

// // Driver management
// router.get("/", driverController.getDrivers);
// router.get("/nearest", driverController.getNearestDrivers);
// router.put("/:driverId", driverController.updateDriver);
// router.delete("/:driverId", driverController.deleteDriver);
// router.post("/logout", driverController.logoutDriver);

// module.exports = router;




