// routes/driverLocationRoutes.js
const express = require("express");
const DriverLocation = require("../models/DriverLocation");
const router = express.Router();


router.post('/create-test-driver', async (req, res) => {
  try {
    const { driverId, name, phone, password } = req.body;
    
    // Check if driver already exists
    const existingDriver = await Driver.findOne({ driverId });
    if (existingDriver) {
      return res.status(400).json({ msg: "Driver already exists" });
    }
    
    // Create new driver
    const bcrypt = require('bcryptjs');
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
        coordinates: [0, 0]
      }
    });
    
    await driver.save();
    
    res.status(201).json({
      success: true,
      msg: "Test driver created successfully",
      driver: {
        driverId: driver.driverId,
        name: driver.name,
        phone: driver.phone
      }
    });
  } catch (error) {
    console.error("Error creating test driver:", error);
    res.status(500).json({ error: error.message });
  }
});





// Save or update current driver location
router.post("/driver-location/update", async (req, res) => {
  try {
    const { driverId, driverName, latitude, longitude, vehicleType, status = "Live" } = req.body;
    
    // Validate required fields
    if (!driverId || !driverName || !latitude || !longitude) {
      return res.status(400).json({ success: false, error: "Missing required data" });
    }
    
    // Create new location document (not updating existing)
    const location = new DriverLocation({
      driverId,
      driverName,
      latitude,
      longitude,
      vehicleType,
      status,
      timestamp: new Date(),
    });
    
    await location.save();
    res.json({ 
      success: true, 
      message: "📍 Location saved", 
      location: {
        driverId: location.driverId,
        driverName: location.driverName,
        latitude: location.latitude,
        longitude: location.longitude,
        vehicleType: location.vehicleType,
        status: location.status,
        timestamp: location.timestamp
      }
    });
  } catch (error) {
    console.error("❌ Error saving driver location:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get latest location for one driver
router.get("/driver-location/:driverId", async (req, res) => {
  try {
    const { driverId } = req.params;
    const latestLocation = await DriverLocation.findOne({ driverId })
      .sort({ timestamp: -1 })
      .select("-__v -_id");
    
    if (!latestLocation) {
      return res.status(404).json({ success: false, error: "No location found for this driver" });
    }
    
    res.json({ success: true, location: latestLocation });
  } catch (error) {
    console.error("❌ Error fetching driver location:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all active drivers (status: "Live")
router.get("/driver-location/active", async (req, res) => {
  try {
    // Find the most recent location for each driver with "Live" status
    const activeDrivers = await DriverLocation.aggregate([
      { $match: { status: "Live" } },
      { $sort: { timestamp: -1 } },
      { $group: {
          _id: "$driverId",
          driverId: { $first: "$driverId" },
          latitude: { $first: "$latitude" },
          longitude: { $first: "$longitude" },
          vehicleType: { $first: "$vehicleType" },
          status: { $first: "$status" },
          timestamp: { $first: "$timestamp" }
        }
      }
    ]);
    
    res.json({ success: true, drivers: activeDrivers });
  } catch (error) {
    console.error("❌ Error fetching active drivers:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get location history for a driver
router.get("/driver-location/:driverId/history", async (req, res) => {
  try {
    const { driverId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const history = await DriverLocation.find({ driverId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select("-__v -_id");
    
    res.json({ 
      success: true, 
      history,
      total: await DriverLocation.countDocuments({ driverId })
    });
  } catch (error) {
    console.error("❌ Error fetching driver location history:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;






// // routes/driverLocationHistoryRoutes.js
// const express = require("express");
// const DriverLocation = require("../models/DriverLocation");
// const router = express.Router();

// // GET /api/driver-locations/:driverId - Get location history for a specific driver
// router.get("/driver-locations/:driverId", async (req, res) => {
//   try {
//     const { driverId } = req.params;
//     const { startTime, endTime, limit = 100 } = req.query;
    
//     let query = { driverId };
    
//     // Add time filter if provided
//     if (startTime && endTime) {
//       query.timestamp = {
//         $gte: new Date(startTime),
//         $lte: new Date(endTime)
//       };
//     }
    
//     const locations = await DriverLocation.find(query)
//       .sort({ timestamp: -1 })
//       .limit(parseInt(limit))
//       .select("driverId latitude longitude vehicleType status timestamp -_id");
    
//     res.json({
//       success: true,
//       count: locations.length,
//       locations
//     });
//   } catch (error) {
//     console.error("❌ Error fetching driver locations:", error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });

// // GET /api/driver-locations - Get latest locations of all drivers
// router.get("/driver-locations", async (req, res) => {
//   try {
//     const { status = "Live", limit = 50 } = req.query;
    
//     // Get the latest location for each driver
//     const locations = await DriverLocation.aggregate([
//       { $match: { status } },
//       { $sort: { timestamp: -1 } },
//       {
//         $group: {
//           _id: "$driverId",
//           latestLocation: { $first: "$$ROOT" }
//         }
//       },
//       { $replaceRoot: { newRoot: "$latestLocation" } },
//       { $limit: parseInt(limit) },
//       { $project: { _id: 0, __v: 0 } }
//     ]);
    
//     res.json({
//       success: true,
//       count: locations.length,
//       locations
//     });
//   } catch (error) {
//     console.error("❌ Error fetching driver locations:", error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });

// // GET /api/drivers/nearby/history - Get historical nearby drivers
// router.get("/drivers/nearby/history", async (req, res) => {
//   try {
//     const { latitude, longitude, radius = 2000, timestamp } = req.query;
    
//     if (!latitude || !longitude) {
//       return res.status(400).json({
//         success: false,
//         error: "Latitude and longitude are required"
//       });
//     }
    
//     const targetTime = timestamp ? new Date(timestamp) : new Date();
//     const timeWindow = 5 * 60 * 1000; // 5 minutes window
    
//     // Find locations within the time window
//     const locations = await DriverLocation.find({
//       timestamp: {
//         $gte: new Date(targetTime.getTime() - timeWindow),
//         $lte: new Date(targetTime.getTime() + timeWindow)
//       },
//       status: "Live"
//     });
    
//     // Filter by distance
//     const nearbyDrivers = locations
//       .map(location => {
//         const distance = calculateDistance(
//           parseFloat(latitude), parseFloat(longitude),
//           location.latitude, location.longitude
//         );
        
//         return {
//           driverId: location.driverId,
//           latitude: location.latitude,
//           longitude: location.longitude,
//           vehicleType: location.vehicleType,
//           distance,
//           timestamp: location.timestamp
//         };
//       })
//       .filter(driver => driver.distance <= radius)
//       .sort((a, b) => a.distance - b.distance)
//       .slice(0, 20); // Limit to 20 results
    
//     res.json({
//       success: true,
//       count: nearbyDrivers.length,
//       drivers: nearbyDrivers,
//       requestedTime: targetTime
//     });
//   } catch (error) {
//     console.error("❌ Error fetching historical nearby drivers:", error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });

// // Helper function to calculate distance
// function calculateDistance(lat1, lon1, lat2, lon2) {
//   const R = 6371e3; // Earth's radius in meters
//   const φ1 = lat1 * Math.PI/180;
//   const φ2 = lat2 * Math.PI/180;
//   const Δφ = (lat2-lat1) * Math.PI/180;
//   const Δλ = (lon2-lon1) * Math.PI/180;

//   const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
//             Math.cos(φ1) * Math.cos(φ2) *
//             Math.sin(Δλ/2) * Math.sin(Δλ/2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

//   return R * c; // Distance in meters
// }

// module.exports = router;