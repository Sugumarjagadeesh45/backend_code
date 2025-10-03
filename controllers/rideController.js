// D:\newapp\fullbackend-main\fullbackend-main_\controllers\rideController.js
const User = require('../models/user/Registration');
const Driver = require('../models/driver/driver');
const Ride = require('../models/ride');
const RaidId = require('../models/user/raidId');
const jwt = require('jsonwebtoken');

// --- Auth middleware ---
exports.userAuth = (req, res, next) => {
  console.log('🔐 Running userAuth middleware');
  const header = req.headers.authorization;
  if (!header) {
    console.log('❌ No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = data;
    console.log('✅ Token verified, user:', data);
    next();
  } catch (err) {
    console.log('❌ Invalid token:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};


// In rideController.js - Add this function
exports.createRideFromSocket = async (io, rideData) => {
  try {
    console.log("📥 Incoming ride request from socket:", JSON.stringify(rideData, null, 2));

    // Validate required fields
    const requiredFields = ['userId', 'customerId', 'userName', 'pickup', 'drop', 'vehicleType'];
    const missingFields = requiredFields.filter(field => !rideData[field]);

    if (missingFields.length > 0) {
      console.log("❌ Missing required fields:", missingFields);
      return { success: false, message: `Missing required fields: ${missingFields.join(', ')}` };
    }

    // Generate sequential RAID_ID
    const raidId = await generateSequentialRaidId();
    
    // Extract coordinates from socket data
    const pickupCoordinates = {
      latitude: rideData.pickup.lat,
      longitude: rideData.pickup.lng
    };
    
    const dropoffCoordinates = {
      latitude: rideData.drop.lat,
      longitude: rideData.drop.lng
    };

    // Create ride data for database
    const rideDataForDB = {
      user: rideData.userId,
      customerId: rideData.customerId,
      name: rideData.userName,
      RAID_ID: raidId,
      pickupLocation: rideData.pickup.address || 'Selected Location',
      dropoffLocation: rideData.drop.address || 'Selected Location',
      pickupCoordinates: pickupCoordinates,
      dropoffCoordinates: dropoffCoordinates,
      fare: rideData.price || 0,
      rideType: rideData.vehicleType,
      otp: rideData.otp || rideData.customerId.slice(-4),
      distance: rideData.distance || '0 km',
      travelTime: rideData.travelTime || '0 mins',
      status: "pending",
      Raid_date: new Date(),
      Raid_time: new Date().toLocaleTimeString('en-US', { 
        timeZone: 'Asia/Kolkata', 
        hour12: true 
      })
    };

    console.log("💾 Saving ride to database from socket:", rideDataForDB);
    const ride = new Ride(rideDataForDB);
    await ride.save();

    console.log("✅ Ride saved successfully to MongoDB:", ride);

    // Backend-specific logging
    console.log("\n🚀 RIDE BOOKED SUCCESSFULLY VIA SOCKET:");
    console.log(`👤 Customer Name: ${rideData.userName}`);
    console.log(`🆔 Customer ID: ${rideData.customerId}`);
    console.log(`🆔 Generated RAID_ID: ${raidId}`);
    console.log("=====================================\n");

    // Return success with ride data
    return {
      success: true,
      ride: ride,
      raidId: raidId,
      otp: rideDataForDB.otp,
      message: "Ride booked successfully!"
    };

  } catch (err) {
    console.error("❌ Error saving ride from socket:", err.message);
    return {
      success: false,
      message: err.message
    };
  }
};


// --- Helpers ---
function calculateFare(distanceKm, vehicleType) {
  console.log(`🧮 Calculating fare for distance: ${distanceKm} km, vehicleType: ${vehicleType}`);
  const base = vehicleType === 'EV' ? 15 : (vehicleType === 'Auto' ? 10 : 12);
  const price = Math.max(50, Math.round(base * distanceKm));
  const points = Math.round(distanceKm * 5);
  return { price, points };
}

// --- GET all rides ---
exports.getRides = async (req, res) => {
  try {
    console.log('📋 Fetching all rides');
    const rides = await Ride.find().populate('driver').populate('user');
    res.json(rides);
  } catch (err) {
    console.error('❌ Error fetching rides:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// --- CREATE Ride ---
exports.createRide = async (req, res) => {
  console.log('🚀 Entering createRide function');
  try {
    console.log("📥 Incoming ride request body:", JSON.stringify(req.body, null, 2));
    console.log("👤 Authenticated user:", req.user);

    // Validate required fields
    const requiredFields = ['user', 'customerId', 'name', 'pickupLocation', 'dropoffLocation', 'fare', 'rideType', 'otp', 'distance', 'travelTime'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      console.log("❌ Missing required fields:", missingFields);
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missingFields: missingFields 
      });
    }

    // Generate sequential RAID_ID
    console.log("🔄 Generating RAID_ID...");
    const raidId = await generateSequentialRaidId();
    console.log("🆔 Generated RAID_ID:", raidId);

    // Create the ride with the RAID_ID
    const rideData = {
      ...req.body,
      RAID_ID: raidId,
      status: "pending",
      Raid_date: new Date(),
      Raid_time: new Date().toLocaleTimeString('en-US', { 
        timeZone: 'Asia/Kolkata', 
        hour12: true 
      })
    };

    console.log("💾 Saving ride to database:", rideData);
    const ride = new Ride(rideData);
    await ride.save();

    console.log("✅ Ride saved successfully:", ride);

    // Backend-specific logging for booking confirmation
    console.log("\n🚀 RIDE BOOKED SUCCESSFULLY (BACKEND CONFIRMATION):");
    console.log(`👤 Customer Name: ${req.body.name}`);
    console.log(`🆔 Customer ID: ${req.body.customerId}`);
    console.log(`📱 Customer Mobile: ${req.body.userMobile || 'Not provided'}`);
    console.log(`🆔 Generated RAID_ID: ${raidId}`);
    console.log("=====================================\n");

    // Get io instance from app
    const io = req.app.get('io');
    if (io) {
      // Emit rideRequest to notify drivers
      io.emit("rideRequest", {
        rideId: raidId,
        pickup: { 
          address: ride.pickupLocation, 
          lat: ride.pickupCoordinates.latitude, 
          lng: ride.pickupCoordinates.longitude 
        },
        drop: { 
          address: ride.dropoffLocation, 
          lat: ride.dropoffCoordinates.latitude, 
          lng: ride.dropoffCoordinates.longitude 
        }
      });

      // Emit rideCreated to notify the user who booked the ride
      io.to(req.user._id.toString()).emit("rideCreated", {
        success: true,
        rideId: raidId,
        otp: req.body.otp,
        message: "Ride booked successfully!"
      });
    } else {
      console.error("❌ Socket.io instance not found");
    }

    res.status(201).json({ 
      success: true, 
      ride: ride,
      raidId: raidId,
      message: "Ride booked successfully!" 
    });
  } catch (err) {
    console.error("❌ Error saving ride:", err.message);
    console.error("❌ Error stack:", err.stack);
    res.status(500).json({ 
      error: 'Failed to create ride',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

async function generateSequentialRaidId() {
  try {
    console.log('🔢 Generating sequential RAID_ID');
    

    const raidIdDoc = await RaidId.findOneAndUpdate(
      { _id: 'raidId' },
      { $inc: { sequence: 1 } },
      { 
        new: true, 
        upsert: true,
        // Add this to handle concurrent requests
        session: await RaidId.startSession() 
      }
    ).session(raidIdDoc._session).exec();

    // Format as 6-digit number (100000 to 999999)
    const sequenceNumber = raidIdDoc.sequence;
    console.log("🔢 Sequence number:", sequenceNumber);

    if (sequenceNumber > 999999) {
      console.log('🔄 Resetting sequence to 100000');
      await RaidId.findByIdAndUpdate('raidId', { sequence: 100000 });
      return 'RID100000';
    }

    return 'RID' + sequenceNumber;
  } catch (error) {
    console.error('❌ Error generating sequential RAID_ID:', error.message);
    // Fallback to timestamp-based ID with better uniqueness
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    const fallbackId = 'RID_' + timestamp + random;
    console.log('🔄 Using fallback ID:', fallbackId);
    return fallbackId;
  }
}
// --- UPDATE ride ---
exports.updateRide = async (req, res) => {
  try {
    console.log(`Updating ride with RAID_ID: ${req.params.rideId}`);
    console.log("Update data:", req.body);

    const ride = await Ride.findOneAndUpdate(
      { RAID_ID: req.params.rideId },
      req.body,
      { new: true }
    );

    if (!ride) {
      console.log(`Ride not found with RAID_ID: ${req.params.rideId}`);
      return res.status(404).json({ error: 'Ride not found' });
    }

    console.log("✅ Ride updated successfully:", ride);

    // Emit status update to frontend
    const io = req.app.get('io');
    if (io) {
      io.to(ride._id.toString()).emit("rideStatusUpdate", { 
        rideId: ride._id.toString(), 
        status: ride.status 
      });
    }

    res.json(ride);
  } catch (err) {
    console.error("❌ Error updating ride:", err);
    res.status(400).json({ error: err.message });
  }
};

// --- DELETE ride ---
exports.deleteRide = async (req, res) => {
  try {
    const ride = await Ride.findOneAndDelete({ RAID_ID: req.params.rideId });
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    res.json({ message: 'Ride deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Get ride by RAID_ID ---
exports.getRideById = async (req, res) => {
  try {
    const ride = await Ride.findOne({ RAID_ID: req.params.rideId })
      .populate('user');
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    res.json(ride);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Accept Ride ---
exports.acceptRide = async (req, res) => {
  try {
    const { rideId, driverId } = req.body;
    const ride = await Ride.findOne({ _id: rideId });
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'pending') return res.status(400).json({ error: 'Ride already taken' });

    const otp = ride.otp;

    ride.driver = driverId;
    ride.status = 'accepted';
    await ride.save();

    const io = req.app.get('io');
    if (io) {
      io.to(ride.user.toString()).emit("rideAccepted", {
        rideId: ride._id.toString(),
        driverId,
        driverName: req.body.driverName,
        otp
      });

      io.to(`driver_${driverId}`).emit("rideOTP", {
        rideId: ride._id.toString(),
        otp
      });
    }

    res.json({ success: true, ride, otp });
  } catch (err) {
    console.error("❌ Error accepting ride:", err);
    res.status(500).json({ error: err.message });
  }
};

// --- Mark Arrived ---
exports.markArrived = async (req, res) => {
  try {
    const ride = await Ride.findOne({ RAID_ID: req.params.rideId });
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'accepted') return res.status(400).json({ error: 'Cannot mark arrived now' });

    ride.status = 'arrived';
    await ride.save();

    const io = req.app.get('io');
    if (io) {
      io.to(ride._id.toString()).emit("rideStatusUpdate", {
        rideId: ride._id.toString(),
        status: ride.status
      });
    }

    res.json({ success: true, ride });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Start Ride ---
exports.startRide = async (req, res) => {
  try {
    const { otp } = req.body;
    const ride = await Ride.findOne({ RAID_ID: req.params.rideId });
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'arrived') return res.status(400).json({ error: 'Ride must be arrived before start' });
    if (ride.otp && ride.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    ride.status = 'ongoing';
    await ride.save();

    const io = req.app.get('io');
    if (io) {
      io.to(ride._id.toString()).emit("rideStatusUpdate", {
        rideId: ride._id.toString(),
        status: ride.status
      });
    }

    res.json({ success: true, ride });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Complete Ride ---
exports.completeRide = async (req, res) => {
  try {
    const ride = await Ride.findOne({ RAID_ID: req.params.rideId }).populate('user driver');
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'ongoing') return res.status(400).json({ error: 'Ride must be ongoing to complete' });

    ride.status = 'completed';
    await ride.save();

    const user = await User.findById(ride.user._id);
    user.wallet.points = (user.wallet.points || 0) + (ride.pointsEarned || 0);
    await user.save();

    if (ride.driver) {
      const driver = await Driver.findById(ride.driver._id);
      driver.earnings = (driver.earnings || 0) + ride.fare;
      await driver.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(ride._id.toString()).emit("rideStatusUpdate", {
        rideId: ride._id.toString(),
        status: ride.status
      });
    }

    res.json({ success: true, ride, newUserPoints: user.wallet.points });
  } catch (err) {
    console.error("❌ Error completing ride:", err);
    res.status(500).json({ error: err.message });
  }
};