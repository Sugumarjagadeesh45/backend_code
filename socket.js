const { Server } = require("socket.io");
const DriverLocation = require("./models/DriverLocation");
const Driver = require("./models/driver/driver");
const Ride = require("./models/ride");
const RaidId = require("./models/user/raidId");
const mongoose = require('mongoose');

let io;
const rides = {};
const activeDriverSockets = new Map();
const processingRides = new Set();

// Helper function to log current driver status
const logDriverStatus = () => {
  console.log("\n📊 === CURRENT DRIVER STATUS ===");
  if (activeDriverSockets.size === 0) {
    console.log("❌ No drivers currently online");
  } else {
    console.log(`✅ ${activeDriverSockets.size} drivers currently online:`);
    activeDriverSockets.forEach((driver, driverId) => {
      const timeSinceUpdate = Math.floor((Date.now() - driver.lastUpdate) / 1000);
      console.log(`  🚗 ${driver.driverName} (${driverId})`);
      console.log(`     Status: ${driver.status}`);
      console.log(`     Vehicle: ${driver.vehicleType}`);
      console.log(`     Location: ${driver.location.latitude.toFixed(6)}, ${driver.location.longitude.toFixed(6)}`);
      console.log(`     Last update: ${timeSinceUpdate}s ago`);
      console.log(`     Socket: ${driver.socketId}`);
      console.log(`     Online: ${driver.isOnline ? 'Yes' : 'No'}`);
    });
  }
  console.log("================================\n");
};

// Helper function to log ride status
const logRideStatus = () => {
  console.log("\n🚕 === CURRENT RIDE STATUS ===");
  const rideEntries = Object.entries(rides);
  if (rideEntries.length === 0) {
    console.log("❌ No active rides");
  } else {
    console.log(`✅ ${rideEntries.length} active rides:`);
    rideEntries.forEach(([rideId, ride]) => {
      console.log(`  📍 Ride ${rideId}:`);
      console.log(`     Status: ${ride.status}`);
      console.log(`     Driver: ${ride.driverId || 'Not assigned'}`);
      console.log(`     User: ${ride.userId}`);
      console.log(`     Pickup: ${ride.pickup?.address || ride.pickup?.lat + ',' + ride.pickup?.lng}`);
      console.log(`     Drop: ${ride.drop?.address || ride.drop?.lat + ',' + ride.drop?.lng}`);
    });
  }
  console.log("================================\n");
};

// Test the RaidId model on server startup
async function testRaidIdModel() {
  try {
    console.log('🧪 Testing RaidId model...');
    const testDoc = await RaidId.findOne({ _id: 'raidId' });
    console.log('🧪 RaidId document:', testDoc);
    
    if (!testDoc) {
      console.log('🧪 Creating initial RaidId document');
      const newDoc = new RaidId({ _id: 'raidId', sequence: 100000 });
      await newDoc.save();
      console.log('🧪 Created initial RaidId document');
    }
  } catch (error) {
    console.error('❌ Error testing RaidId model:', error);
  }
}

// RAID_ID generation function
async function generateSequentialRaidId() {
  try {
    console.log('🔢 Starting RAID_ID generation');
    
    const raidIdDoc = await RaidId.findOneAndUpdate(
      { _id: 'raidId' },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );
    
    console.log('🔢 RAID_ID document:', raidIdDoc);

    let sequenceNumber = raidIdDoc.sequence;
    console.log('🔢 Sequence number:', sequenceNumber);

    if (sequenceNumber > 999999) {
      console.log('🔄 Resetting sequence to 100000');
      await RaidId.findOneAndUpdate(
        { _id: 'raidId' },
        { sequence: 100000 }
      );
      sequenceNumber = 100000;
    }

    const formattedSequence = sequenceNumber.toString().padStart(6, '0');
    const raidId = `RID${formattedSequence}`;
    console.log(`🔢 Generated RAID_ID: ${raidId}`);
    
    return raidId;
  } catch (error) {
    console.error('❌ Error generating sequential RAID_ID:', error);
    
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const fallbackId = `RID${timestamp}${random}`;
    console.log(`🔄 Using fallback ID: ${fallbackId}`);
    
    return fallbackId;
  }
}

// Helper function to save driver location to database
async function saveDriverLocationToDB(driverId, driverName, latitude, longitude, vehicleType, status = "Live") {
  try {
    const locationDoc = new DriverLocation({
      driverId,
      driverName,
      latitude,
      longitude,
      vehicleType,
      status,
      timestamp: new Date()
    });
    
    await locationDoc.save();
    console.log(`💾 Saved location for driver ${driverId} (${driverName}) to database`);
    return true;
  } catch (error) {
    console.error("❌ Error saving driver location to DB:", error);
    return false;
  }
}

// Helper function to broadcast driver locations to all users
function broadcastDriverLocationsToAllUsers() {
  const drivers = Array.from(activeDriverSockets.values())
    .filter(driver => driver.isOnline)
    .map(driver => ({
      driverId: driver.driverId,
      name: driver.driverName,
      location: {
        coordinates: [driver.location.longitude, driver.location.latitude]
      },
      vehicleType: driver.vehicleType,
      status: driver.status,
      lastUpdate: driver.lastUpdate
    }));
  
  io.emit("driverLocationsUpdate", { drivers });
}

const init = (server) => {
  io = new Server(server, {
    cors: { 
      origin: "*", 
      methods: ["GET", "POST"] 
    },
  });
  
  // Test the RaidId model on startup
  testRaidIdModel();
  
  // Log server status every 30 seconds
  setInterval(() => {
    console.log(`\n⏰ ${new Date().toLocaleString()} - Server Status Check`);
    logDriverStatus();
    logRideStatus();
  }, 30000);
  
  io.on("connection", (socket) => {
    console.log(`\n⚡ New client connected: ${socket.id}`);
    console.log(`📱 Total connected clients: ${io.engine.clientsCount}`);
    
    // ========== REAL-TIME DRIVER LOCATION BROADCASTING ==========
    
    // -------------------- DRIVER LOCATION UPDATE (REAL-TIME BROADCAST) --------------------
    socket.on("driverLocationUpdate", async (data) => {
      try {
        const { driverId, latitude, longitude, status } = data;
        
        console.log(`📍 REAL-TIME: Driver ${driverId} location update received`);
        console.log(`🗺️  Coordinates: ${latitude}, ${longitude}, Status: ${status}`);
        
        // Update driver in activeDriverSockets
        if (activeDriverSockets.has(driverId)) {
          const driverData = activeDriverSockets.get(driverId);
          driverData.location = { latitude, longitude };
          driverData.lastUpdate = Date.now();
          driverData.status = status || "Live";
          driverData.isOnline = true;
          activeDriverSockets.set(driverId, driverData);
          
          console.log(`✅ Updated driver ${driverId} location in memory`);
        }
        
        // CRITICAL: Broadcast to ALL connected users in REAL-TIME
        io.emit("driverLiveLocationUpdate", {
          driverId: driverId,
          lat: latitude,
          lng: longitude,
          status: status || "Live",
          vehicleType: "taxi",
          timestamp: Date.now()
        });
        
        console.log(`📡 Broadcasted driver ${driverId} location to ALL users`);
        
        // Also update database
        const driverData = activeDriverSockets.get(driverId);
        await saveDriverLocationToDB(
          driverId, 
          driverData?.driverName || "Unknown", 
          latitude, 
          longitude, 
          "taxi", 
          status || "Live"
        );
        
      } catch (error) {
        console.error("❌ Error processing driver location update:", error);
      }
    });
    
    // -------------------- DRIVER LIVE LOCATION UPDATE (IMPROVED) --------------------
    socket.on("driverLiveLocationUpdate", async ({ driverId, driverName, lat, lng }) => {
      try {
        if (activeDriverSockets.has(driverId)) {
          const driverData = activeDriverSockets.get(driverId);
          driverData.location = { latitude: lat, longitude: lng };
          driverData.lastUpdate = Date.now();
          driverData.isOnline = true;
          activeDriverSockets.set(driverId, driverData);
          
          console.log(`\n📍 DRIVER LOCATION UPDATE: ${driverName} (${driverId})`);
          console.log(`🗺️  New location: ${lat}, ${lng}`);
          
          // Save to database immediately
          await saveDriverLocationToDB(driverId, driverName, lat, lng, driverData.vehicleType);
          
          // CRITICAL: Broadcast real-time update to ALL users
          io.emit("driverLiveLocationUpdate", {
            driverId: driverId,
            lat: lat,
            lng: lng,
            status: driverData.status,
            vehicleType: driverData.vehicleType,
            timestamp: Date.now()
          });
          
          console.log(`📡 Real-time update broadcasted for driver ${driverId}`);
        }
      } catch (error) {
        console.error("❌ Error updating driver location:", error);
      }
    });
    
    // ========== END OF REAL-TIME BROADCASTING CODE ==========
    
    // -------------------- USER REGISTRATION (ENHANCED) --------------------
    socket.on('registerUser', ({ userId, userMobile }) => {
      if (!userId) {
        console.error('❌ No userId provided for user registration');
        return;
      }
      
      socket.userId = userId.toString();
      socket.join(userId.toString());
      
      console.log(`👤 USER REGISTERED SUCCESSFULLY:`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Mobile: ${userMobile || 'Not provided'}`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Room: ${userId.toString()}`);
    });
    
    // -------------------- DRIVER REGISTRATION (WITH DEBUG) --------------------
    socket.on("registerDriver", async ({ driverId, driverName, latitude, longitude, vehicleType = "taxi" }) => {
      try {
        console.log(`\n📝 DRIVER REGISTRATION ATTEMPT RECEIVED:`);
        console.log(`   Driver ID: ${driverId}`);
        console.log(`   Driver Name: ${driverName}`);
        console.log(`   Location: ${latitude}, ${longitude}`);
        console.log(`   Vehicle: ${vehicleType}`);
        console.log(`   Socket ID: ${socket.id}`);
        
        if (!driverId) {
          console.log("❌ Registration failed: No driverId provided");
          return;
        }
        
        if (!latitude || !longitude) {
          console.log("❌ Registration failed: Invalid location");
          return;
        }

        socket.driverId = driverId;
        socket.driverName = driverName;
        
        // Store driver connection info
        activeDriverSockets.set(driverId, {
          socketId: socket.id,
          driverId,
          driverName,
          location: { latitude, longitude },
          vehicleType,
          lastUpdate: Date.now(),
          status: "Live",
          isOnline: true
        });
        
        // Join driver to rooms
        socket.join("allDrivers");
        socket.join(`driver_${driverId}`);
        
        console.log(`✅ DRIVER REGISTERED SUCCESSFULLY: ${driverName} (${driverId})`);
        console.log(`📍 Location: ${latitude}, ${longitude}`);
        console.log(`🚗 Vehicle: ${vehicleType}`);
        console.log(`🔌 Socket ID: ${socket.id}`);
        
        // Save initial location to database
        await saveDriverLocationToDB(driverId, driverName, latitude, longitude, vehicleType);
        
        // Broadcast updated driver list to ALL connected users
        broadcastDriverLocationsToAllUsers();
        
        // Send confirmation to driver
        socket.emit("driverRegistrationConfirmed", {
          success: true,
          message: "Driver registered successfully"
        });
        
        // Log current status
        logDriverStatus();
        
      } catch (error) {
        console.error("❌ Error registering driver:", error);
        
        // Send error to driver
        socket.emit("driverRegistrationConfirmed", {
          success: false,
          message: "Registration failed: " + error.message
        });
      }
    });

    // -------------------- REQUEST NEARBY DRIVERS --------------------
    socket.on("requestNearbyDrivers", ({ latitude, longitude, radius = 5000 }) => {
      try {
        console.log(`\n🔍 USER REQUESTED NEARBY DRIVERS: ${socket.id}`);
        console.log(`📍 User location: ${latitude}, ${longitude}`);
        console.log(`📏 Search radius: ${radius}m`);

        // Get all active drivers (only those who are online)
        const drivers = Array.from(activeDriverSockets.values())
          .filter(driver => driver.isOnline)
          .map(driver => ({
            driverId: driver.driverId,
            name: driver.driverName,
            location: {
              coordinates: [driver.location.longitude, driver.location.latitude]
            },
            vehicleType: driver.vehicleType,
            status: driver.status,
            lastUpdate: driver.lastUpdate
          }));

        console.log(`📊 Active drivers in memory: ${activeDriverSockets.size}`);
        console.log(`📊 Online drivers: ${drivers.length}`);
        
        // Log each driver's details
        drivers.forEach((driver, index) => {
          console.log(`🚗 Driver ${index + 1}: ${driver.name} (${driver.driverId})`);
          console.log(`   Location: ${driver.location.coordinates[1]}, ${driver.location.coordinates[0]}`);
          console.log(`   Status: ${driver.status}`);
          console.log(`   Online: ${activeDriverSockets.get(driver.driverId)?.isOnline}`);
        });

        console.log(`📤 Sending ${drivers.length} online drivers to user`);

        // Send to the requesting client only
        socket.emit("nearbyDriversResponse", { drivers });
      } catch (error) {
        console.error("❌ Error fetching nearby drivers:", error);
        socket.emit("nearbyDriversResponse", { drivers: [] });
      }
    });

    // -------------------- BOOK RIDE --------------------
    socket.on("bookRide", async (data, callback) => {
      let rideId;
      try {
        const { userId, customerId, userName, userMobile, pickup, drop, vehicleType, estimatedPrice, distance, travelTime, wantReturn } = data;

        console.log('📥 Received bookRide request with data:', JSON.stringify(data, null, 2));

        // Generate sequential RAID_ID on backend
        rideId = await generateSequentialRaidId();
        console.log(`🆔 Generated RAID_ID: ${rideId}`);
        
        console.log(`\n🚕 NEW RIDE BOOKING REQUEST: ${rideId}`);
        console.log(`👤 User ID: ${userId}`);
        console.log(`👤 Customer ID: ${customerId}`);
        console.log(`👤 Name: ${userName}`);
        console.log(`📱 Mobile: ${userMobile}`);
        console.log(`📍 Pickup: ${JSON.stringify(pickup)}`);
        console.log(`📍 Drop: ${JSON.stringify(drop)}`);
        console.log(`🚗 Vehicle type: ${vehicleType}`);

        // Generate OTP from customer ID (last 4 digits)
        let otp;
        if (customerId && customerId.length >= 4) {
          otp = customerId.slice(-4);
        } else {
          otp = Math.floor(1000 + Math.random() * 9000).toString();
        }
        console.log(`🔢 OTP: ${otp}`);

        // Check if this ride is already being processed
        if (processingRides.has(rideId)) {
          console.log(`⏭️  Ride ${rideId} is already being processed, skipping`);
          if (callback) {
            callback({
              success: false,
              message: "Ride is already being processed"
            });
          }
          return;
        }
        
        // Add to processing set
        processingRides.add(rideId);

        // Validate required fields
        if (!userId || !customerId || !userName || !pickup || !drop) {
          console.error("❌ Missing required fields");
          processingRides.delete(rideId);
          if (callback) {
            callback({
              success: false,
              message: "Missing required fields"
            });
          }
          return;
        }

        // Check if ride with this ID already exists in database
        const existingRide = await Ride.findOne({ RAID_ID: rideId });
        if (existingRide) {
          console.log(`⏭️  Ride ${rideId} already exists in database, skipping`);
          processingRides.delete(rideId);
          if (callback) {
            callback({
              success: true,
              rideId: rideId,
              _id: existingRide._id.toString(),
              otp: existingRide.otp,
              message: "Ride already exists"
            });
          }
          return;
        }

        // Create a new ride document in MongoDB
        const rideData = {
          user: userId,
          customerId: customerId,
          name: userName,
          RAID_ID: rideId,
          pickupLocation: pickup.address || "Selected Location",
          dropoffLocation: drop.address || "Selected Location",
          pickupCoordinates: {
            latitude: pickup.lat,
            longitude: pickup.lng
          },
          dropoffCoordinates: {
            latitude: drop.lat,
            longitude: drop.lng
          },
          fare: estimatedPrice || 0,
          rideType: vehicleType,
          otp: otp,
          distance: distance || "0 km",
          travelTime: travelTime || "0 mins",
          isReturnTrip: wantReturn || false,
          status: "pending",
          Raid_date: new Date(),
          Raid_time: new Date().toLocaleTimeString('en-US', { 
            timeZone: 'Asia/Kolkata', 
            hour12: true 
          }),
          pickup: {
            addr: pickup.address || "Selected Location",
            lat: pickup.lat,
            lng: pickup.lng,
          },
          drop: {
            addr: drop.address || "Selected Location",
            lat: drop.lat,
            lng: drop.lng,
          },
          price: estimatedPrice || 0,
          distanceKm: parseFloat(distance) || 0
        };

        console.log('💾 Ride data to be saved:', JSON.stringify(rideData, null, 2));

        // Create and save the ride
        const newRide = new Ride(rideData);
        
        // Validate the document before saving
        try {
          await newRide.validate();
          console.log('✅ Document validation passed');
        } catch (validationError) {
          console.error('❌ Document validation failed:', validationError);
          throw validationError;
        }

        // Save to MongoDB
        const savedRide = await newRide.save();
        console.log(`💾 Ride saved to MongoDB with ID: ${savedRide._id}`);
        console.log(`💾 RAID_ID in saved document: ${savedRide.RAID_ID}`);

        // Store ride data in memory for socket operations
        rides[rideId] = {
          ...data,
          rideId: rideId,
          status: "pending",
          timestamp: Date.now(),
          _id: savedRide._id.toString()
        };

        // Broadcast to all drivers
        io.emit("newRideRequest", {
          ...data,
          rideId: rideId,
          _id: savedRide._id.toString()
        });

        // Send success response with backend-generated rideId
        if (callback) {
          callback({
            success: true,
            rideId: rideId,
            _id: savedRide._id.toString(),
            otp: otp,
            message: "Ride booked successfully!"
          });
        }

        console.log(`📡 Ride request broadcasted to all drivers with ID: ${rideId}`);
        console.log(`💾 Ride saved to MongoDB with ID: ${savedRide._id}`);

        // Log current status
        logRideStatus();

      } catch (error) {
        console.error("❌ Error booking ride:", error);
        
        // Handle specific validation errors
        if (error.name === 'ValidationError') {
          const errors = Object.values(error.errors).map(err => err.message);
          console.error("❌ Validation errors:", errors);
          
          if (callback) {
            callback({
              success: false,
              message: `Validation failed: ${errors.join(', ')}`
            });
          }
        } 
        // Handle duplicate key error
        else if (error.code === 11000 && error.keyPattern && error.keyPattern.RAID_ID) {
          console.log(`🔄 Duplicate RAID_ID detected: ${rideId}`);
          
          try {
            // Try to find the existing ride
            const existingRide = await Ride.findOne({ RAID_ID: rideId });
            if (existingRide && callback) {
              callback({
                success: true,
                rideId: rideId,
                _id: existingRide._id.toString(),
                otp: existingRide.otp,
                message: "Ride already exists (duplicate handled)"
              });
            }
          } catch (findError) {
            console.error("❌ Error finding existing ride:", findError);
            if (callback) {
              callback({
                success: false,
                message: "Failed to process ride booking (duplicate error)"
              });
            }
          }
        } else {
          if (callback) {
            callback({
              success: false,
              message: "Failed to process ride booking"
            });
          }
        }
      } finally {
        // Always remove from processing set
        if (rideId) {
          processingRides.delete(rideId);
        }
      }
    });

    // -------------------- JOIN ROOM --------------------
    socket.on('joinRoom', async (data) => {
      try {
        const { userId } = data;
        if (userId) {
          socket.join(userId.toString());
          console.log(`✅ User ${userId} joined their room via joinRoom event`);
        }
      } catch (error) {
        console.error('Error in joinRoom:', error);
      }
    });

    // -------------------- BULLETPROOF RIDE ACCEPTANCE HANDLER --------------------
    socket.on("acceptRide", async (data, callback) => {
      const { rideId, driverId, driverName } = data;

      console.log("🚨 ===== BACKEND ACCEPT RIDE START =====");
      console.log("📥 Acceptance Data:", { rideId, driverId, driverName });
      console.log("🚨 ===== BACKEND ACCEPT RIDE END =====");

      try {
        // ✅ 1. FIND RIDE IN DATABASE
        console.log(`🔍 Looking for ride: ${rideId}`);
        const ride = await Ride.findOne({ RAID_ID: rideId });
        
        if (!ride) {
          console.error(`❌ Ride ${rideId} not found in database`);
          if (typeof callback === "function") {
            callback({ success: false, message: "Ride not found" });
          }
          return;
        }

        console.log(`✅ Found ride: ${ride.RAID_ID}, Status: ${ride.status}`);

        // ✅ 2. CHECK IF RIDE IS ALREADY ACCEPTED
        if (ride.status === "accepted") {
          console.log(`🚫 Ride ${rideId} already accepted by: ${ride.driverId}`);
          
          // Notify all drivers
          socket.broadcast.emit("rideAlreadyAccepted", { 
            rideId,
            message: "This ride has already been accepted by another driver."
          });
          
          if (typeof callback === "function") {
            callback({ 
              success: false, 
              message: "This ride has already been accepted by another driver." 
            });
          }
          return;
        }

        // ✅ 3. UPDATE RIDE STATUS
        console.log(`🔄 Updating ride status to 'accepted'`);
        ride.status = "accepted";
        ride.driverId = driverId;
        ride.driverName = driverName;

        // ✅ 4. GET DRIVER DETAILS
        const driver = await Driver.findOne({ driverId });
        console.log(`👨‍💼 Driver details:`, driver ? "Found" : "Not found");
        
        if (driver) {
          ride.driverMobile = driver.phone;
          console.log(`📱 Driver mobile: ${driver.phone}`);
        } else {
          ride.driverMobile = "N/A";
          console.log(`⚠️ Driver not found in Driver collection`);
        }

        // ✅ 5. ENSURE OTP EXISTS
        if (!ride.otp) {
          const otp = Math.floor(1000 + Math.random() * 9000).toString();
          ride.otp = otp;
          console.log(`🔢 Generated new OTP: ${otp}`);
        } else {
          console.log(`🔢 Using existing OTP: ${ride.otp}`);
        }

        // ✅ 6. SAVE TO DATABASE
        await ride.save();
        console.log(`💾 Ride saved successfully`);

        // ✅ 7. PREPARE DRIVER DATA FOR USER
        const driverData = {
          success: true,
          rideId: ride.RAID_ID,
          driverId: driverId,
          driverName: driverName,
          driverMobile: ride.driverMobile,
          driverLat: driver?.location?.coordinates?.[1] || 0,
          driverLng: driver?.location?.coordinates?.[0] || 0,
          otp: ride.otp,
          pickup: ride.pickup,
          drop: ride.drop,
          status: ride.status,
          vehicleType: driver?.vehicleType || "taxi",
          timestamp: new Date().toISOString()
        };

        console.log("📤 Prepared driver data:", JSON.stringify(driverData, null, 2));

        // ✅ 8. SEND CONFIRMATION TO DRIVER
        if (typeof callback === "function") {
          console.log("📨 Sending callback to driver");
          callback(driverData);
        }

        // ✅ 9. NOTIFY USER WITH MULTIPLE CHANNELS
        const userRoom = ride.user.toString();
        console.log(`📡 Notifying user room: ${userRoom}`);
        
        // Method 1: Standard room emission
        io.to(userRoom).emit("rideAccepted", driverData);
        console.log("✅ Notification sent via standard room channel");

        // Method 2: Direct to all sockets in room
        const userSockets = await io.in(userRoom).fetchSockets();
        console.log(`🔍 Found ${userSockets.length} sockets in user room`);
        userSockets.forEach((userSocket, index) => {
          userSocket.emit("rideAccepted", driverData);
          console.log(`✅ Notification sent to user socket ${index + 1}: ${userSocket.id}`);
        });

        // Method 3: Global emit with user filter (for debugging)
        io.emit("rideAcceptedGlobal", {
          ...driverData,
          targetUserId: userRoom,
          timestamp: new Date().toISOString()
        });
        console.log("✅ Global notification sent with user filter");

        // Method 4: Backup delayed emission
        setTimeout(() => {
          io.to(userRoom).emit("rideAccepted", driverData);
          console.log("✅ Backup notification sent after delay");
        }, 1000);

        // ✅ NEW: Send user data to the driver who accepted the ride
        const userDataForDriver = {
          success: true,
          rideId: ride.RAID_ID,
          userId: ride.user,
          customerId: ride.customerId,
          userName: ride.name,
          userMobile: ride.userMobile || "N/A",
          pickup: ride.pickup,
          drop: ride.drop,
          otp: ride.otp,
          status: ride.status,
          timestamp: new Date().toISOString()
        };

        // Send to the specific driver socket
        const driverSocket = Array.from(io.sockets.sockets.values()).find(s => s.driverId === driverId);
        if (driverSocket) {
          driverSocket.emit("userDataForDriver", userDataForDriver);
          console.log("✅ User data sent to driver:", driverId);
        } else {
          // Fallback to driver room
          io.to(`driver_${driverId}`).emit("userDataForDriver", userDataForDriver);
          console.log("✅ User data sent to driver room:", driverId);
        }

        // ✅ 10. NOTIFY OTHER DRIVERS
        socket.broadcast.emit("rideAlreadyAccepted", { 
          rideId,
          message: "This ride has already been accepted by another driver."
        });
        console.log("📢 Other drivers notified");

        // ✅ 11. UPDATE DRIVER STATUS IN MEMORY
        if (activeDriverSockets.has(driverId)) {
          const driverInfo = activeDriverSockets.get(driverId);
          driverInfo.status = "onRide";
          driverInfo.isOnline = true;
          activeDriverSockets.set(driverId, driverInfo);
          console.log(`🔄 Updated driver ${driverId} status to 'onRide'`);
        }

        console.log(`🎉 RIDE ${rideId} ACCEPTED SUCCESSFULLY BY ${driverName}`);

      } catch (error) {
        console.error(`❌ ERROR ACCEPTING RIDE ${rideId}:`, error);
        console.error("Stack:", error.stack);
        
        if (typeof callback === "function") {
          callback({ 
            success: false, 
            message: "Server error: " + error.message 
          });
        }
      }
    });

    // -------------------- NEW: Handle user location updates and forward to the assigned driver --------------------
    socket.on("userLocationUpdate", async (data) => {
      try {
        const { userId, latitude, longitude, rideId } = data;
        
        // Find the ride to get the assigned driver
        const ride = await Ride.findOne({ RAID_ID: rideId });
        if (!ride || !ride.driverId) {
          console.log(`❌ No ride or driver found for rideId: ${rideId}`);
          return;
        }
        
        // Send user location to the specific driver
        const driverSocket = Array.from(io.sockets.sockets.values()).find(s => s.driverId === ride.driverId);
        if (driverSocket) {
          driverSocket.emit("userLiveLocationUpdate", {
            userId,
            rideId,
            lat: latitude,
            lng: longitude,
            timestamp: Date.now()
          });
          console.log(`📍 User location sent to driver ${ride.driverId}`);
        } else {
          // Fallback to driver room
          io.to(`driver_${ride.driverId}`).emit("userLiveLocationUpdate", {
            userId,
            rideId,
            lat: latitude,
            lng: longitude,
            timestamp: Date.now()
          });
          console.log(`📍 User location sent to driver room ${ride.driverId}`);
        }
      } catch (error) {
        console.error("❌ Error forwarding user location:", error);
      }
    });

    // -------------------- REJECT RIDE --------------------
    socket.on("rejectRide", (data) => {
      try {
        const { rideId, driverId } = data;
        
        console.log(`\n❌ RIDE REJECTED: ${rideId}`);
        console.log(`🚗 Driver: ${driverId}`);
        
        if (rides[rideId]) {
          rides[rideId].status = "rejected";
          rides[rideId].rejectedAt = Date.now();
          
          // Update driver status back to online
          if (activeDriverSockets.has(driverId)) {
            const driverData = activeDriverSockets.get(driverId);
            driverData.status = "Live";
            driverData.isOnline = true;
            activeDriverSockets.set(driverId, driverData);
            
            socket.emit("driverStatusUpdate", {
              driverId,
              status: "Live"
            });
          }
          
          logRideStatus();
        }
      } catch (error) {
        console.error("❌ Error rejecting ride:", error);
      }
    });
    
    // -------------------- COMPLETE RIDE --------------------
    socket.on("completeRide", (data) => {
      try {
        const { rideId, driverId, distance } = data;
        
        console.log(`\n🎉 RIDE COMPLETED: ${rideId}`);
        console.log(`🚗 Driver: ${driverId}`);
        console.log(`📏 Distance: ${distance.toFixed(2)} km`);
        
        if (rides[rideId]) {
          rides[rideId].status = "completed";
          rides[rideId].completedAt = Date.now();
          rides[rideId].distance = distance;
          
          // Notify the user
          const userId = rides[rideId].userId;
          io.to(userId).emit("rideCompleted", {
            rideId,
            distance
          });
          
          // Update driver status back to online
          if (activeDriverSockets.has(driverId)) {
            const driverData = activeDriverSockets.get(driverId);
            driverData.status = "Live";
            driverData.isOnline = true;
            activeDriverSockets.set(driverId, driverData);
            
            socket.emit("driverStatusUpdate", {
              driverId,
              status: "Live"
            });
          }
          
          // Remove ride after 5 seconds
          setTimeout(() => {
            delete rides[rideId];
            console.log(`🗑️  Removed completed ride: ${rideId}`);
          }, 5000);
          
          logRideStatus();
        }
      } catch (error) {
        console.error("❌ Error completing ride:", error);
      }
    });

    // -------------------- DRIVER HEARTBEAT --------------------
    socket.on("driverHeartbeat", ({ driverId }) => {
      if (activeDriverSockets.has(driverId)) {
        const driverData = activeDriverSockets.get(driverId);
        driverData.lastUpdate = Date.now();
        driverData.isOnline = true;
        activeDriverSockets.set(driverId, driverData);
        
        console.log(`❤️  Heartbeat received from driver: ${driverId}`);
      }
    });
    
    // -------------------- DISCONNECT --------------------
    socket.on("disconnect", () => {
      console.log(`\n❌ Client disconnected: ${socket.id}`);
      console.log(`📱 Remaining connected clients: ${io.engine.clientsCount - 1}`);
      
      if (socket.driverId) {
        console.log(`🛑 Driver ${socket.driverName} (${socket.driverId}) disconnected`);
        
        // Mark driver as offline but keep in memory for a while
        if (activeDriverSockets.has(socket.driverId)) {
          const driverData = activeDriverSockets.get(socket.driverId);
          driverData.isOnline = false;
          driverData.status = "Offline";
          activeDriverSockets.set(socket.driverId, driverData);
          
          saveDriverLocationToDB(
            socket.driverId, 
            socket.driverName,
            driverData.location.latitude, 
            driverData.location.longitude, 
            driverData.vehicleType,
            "Offline"
          ).catch(console.error);
        }
        
        broadcastDriverLocationsToAllUsers();
        logDriverStatus();
      }
    });
  });
  
  // Clean up ONLY offline drivers every 60 seconds
  setInterval(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    let cleanedCount = 0;
    
    Array.from(activeDriverSockets.entries()).forEach(([driverId, driver]) => {
      if (!driver.isOnline && driver.lastUpdate < fiveMinutesAgo) {
        activeDriverSockets.delete(driverId);
        cleanedCount++;
        console.log(`🧹 Removed offline driver (5+ minutes): ${driver.driverName} (${driverId})`);
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`\n🧹 Cleaned up ${cleanedCount} offline drivers`);
      broadcastDriverLocationsToAllUsers();
      logDriverStatus();
    }
  }, 60000);
};

// -------------------- GET IO INSTANCE --------------------
const getIO = () => {
  if (!io) throw new Error("❌ Socket.io not initialized!");
  return io;
};

module.exports = { init, getIO };




// const { Server } = require("socket.io");
// const DriverLocation = require("./models/DriverLocation");
// const Driver = require("./models/driver/driver");
// const Ride = require("./models/ride");
// const RaidId = require("./models/user/raidId");
// const mongoose = require('mongoose');

// let io;
// const rides = {};
// const activeDriverSockets = new Map();
// const processingRides = new Set();

// // Helper function to log current driver status
// const logDriverStatus = () => {
//   console.log("\n📊 === CURRENT DRIVER STATUS ===");
//   if (activeDriverSockets.size === 0) {
//     console.log("❌ No drivers currently online");
//   } else {
//     console.log(`✅ ${activeDriverSockets.size} drivers currently online:`);
//     activeDriverSockets.forEach((driver, driverId) => {
//       const timeSinceUpdate = Math.floor((Date.now() - driver.lastUpdate) / 1000);
//       console.log(`  🚗 ${driver.driverName} (${driverId})`);
//       console.log(`     Status: ${driver.status}`);
//       console.log(`     Vehicle: ${driver.vehicleType}`);
//       console.log(`     Location: ${driver.location.latitude.toFixed(6)}, ${driver.location.longitude.toFixed(6)}`);
//       console.log(`     Last update: ${timeSinceUpdate}s ago`);
//       console.log(`     Socket: ${driver.socketId}`);
//       console.log(`     Online: ${driver.isOnline ? 'Yes' : 'No'}`);
//     });
//   }
//   console.log("================================\n");
// };

// // Helper function to log ride status
// const logRideStatus = () => {
//   console.log("\n🚕 === CURRENT RIDE STATUS ===");
//   const rideEntries = Object.entries(rides);
//   if (rideEntries.length === 0) {
//     console.log("❌ No active rides");
//   } else {
//     console.log(`✅ ${rideEntries.length} active rides:`);
//     rideEntries.forEach(([rideId, ride]) => {
//       console.log(`  📍 Ride ${rideId}:`);
//       console.log(`     Status: ${ride.status}`);
//       console.log(`     Driver: ${ride.driverId || 'Not assigned'}`);
//       console.log(`     User: ${ride.userId}`);
//       console.log(`     Pickup: ${ride.pickup?.address || ride.pickup?.lat + ',' + ride.pickup?.lng}`);
//       console.log(`     Drop: ${ride.drop?.address || ride.drop?.lat + ',' + ride.drop?.lng}`);
//     });
//   }
//   console.log("================================\n");
// };

// // Test the RaidId model on server startup
// async function testRaidIdModel() {
//   try {
//     console.log('🧪 Testing RaidId model...');
//     const testDoc = await RaidId.findOne({ _id: 'raidId' });
//     console.log('🧪 RaidId document:', testDoc);
    
//     if (!testDoc) {
//       console.log('🧪 Creating initial RaidId document');
//       const newDoc = new RaidId({ _id: 'raidId', sequence: 100000 });
//       await newDoc.save();
//       console.log('🧪 Created initial RaidId document');
//     }
//   } catch (error) {
//     console.error('❌ Error testing RaidId model:', error);
//   }
// }

// // RAID_ID generation function
// async function generateSequentialRaidId() {
//   try {
//     console.log('🔢 Starting RAID_ID generation');
    
//     const raidIdDoc = await RaidId.findOneAndUpdate(
//       { _id: 'raidId' },
//       { $inc: { sequence: 1 } },
//       { new: true, upsert: true }
//     );
    
//     console.log('🔢 RAID_ID document:', raidIdDoc);

//     let sequenceNumber = raidIdDoc.sequence;
//     console.log('🔢 Sequence number:', sequenceNumber);

//     if (sequenceNumber > 999999) {
//       console.log('🔄 Resetting sequence to 100000');
//       await RaidId.findOneAndUpdate(
//         { _id: 'raidId' },
//         { sequence: 100000 }
//       );
//       sequenceNumber = 100000;
//     }

//     const formattedSequence = sequenceNumber.toString().padStart(6, '0');
//     const raidId = `RID${formattedSequence}`;
//     console.log(`🔢 Generated RAID_ID: ${raidId}`);
    
//     return raidId;
//   } catch (error) {
//     console.error('❌ Error generating sequential RAID_ID:', error);
    
//     const timestamp = Date.now().toString().slice(-6);
//     const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
//     const fallbackId = `RID${timestamp}${random}`;
//     console.log(`🔄 Using fallback ID: ${fallbackId}`);
    
//     return fallbackId;
//   }
// }

// // Helper function to save driver location to database
// async function saveDriverLocationToDB(driverId, driverName, latitude, longitude, vehicleType, status = "Live") {
//   try {
//     const locationDoc = new DriverLocation({
//       driverId,
//       driverName,
//       latitude,
//       longitude,
//       vehicleType,
//       status,
//       timestamp: new Date()
//     });
    
//     await locationDoc.save();
//     console.log(`💾 Saved location for driver ${driverId} (${driverName}) to database`);
//     return true;
//   } catch (error) {
//     console.error("❌ Error saving driver location to DB:", error);
//     return false;
//   }
// }

// // Helper function to broadcast driver locations to all users
// function broadcastDriverLocationsToAllUsers() {
//   const drivers = Array.from(activeDriverSockets.values())
//     .filter(driver => driver.isOnline)
//     .map(driver => ({
//       driverId: driver.driverId,
//       name: driver.driverName,
//       location: {
//         coordinates: [driver.location.longitude, driver.location.latitude]
//       },
//       vehicleType: driver.vehicleType,
//       status: driver.status,
//       lastUpdate: driver.lastUpdate
//     }));
  
//   io.emit("driverLocationsUpdate", { drivers });
// }

// const init = (server) => {
//   io = new Server(server, {
//     cors: { 
//       origin: "*", 
//       methods: ["GET", "POST"] 
//     },
//   });
  
//   // Test the RaidId model on startup
//   testRaidIdModel();
  
//   // Log server status every 30 seconds
//   setInterval(() => {
//     console.log(`\n⏰ ${new Date().toLocaleString()} - Server Status Check`);
//     logDriverStatus();
//     logRideStatus();
//   }, 30000);
  
//   io.on("connection", (socket) => {
//     console.log(`\n⚡ New client connected: ${socket.id}`);
//     console.log(`📱 Total connected clients: ${io.engine.clientsCount}`);
    
//     // ========== REAL-TIME DRIVER LOCATION BROADCASTING ==========
    
//     // -------------------- DRIVER LOCATION UPDATE (REAL-TIME BROADCAST) --------------------
//     socket.on("driverLocationUpdate", async (data) => {
//       try {
//         const { driverId, latitude, longitude, status } = data;
        
//         console.log(`📍 REAL-TIME: Driver ${driverId} location update received`);
//         console.log(`🗺️  Coordinates: ${latitude}, ${longitude}, Status: ${status}`);
        
//         // Update driver in activeDriverSockets
//         if (activeDriverSockets.has(driverId)) {
//           const driverData = activeDriverSockets.get(driverId);
//           driverData.location = { latitude, longitude };
//           driverData.lastUpdate = Date.now();
//           driverData.status = status || "Live";
//           driverData.isOnline = true;
//           activeDriverSockets.set(driverId, driverData);
          
//           console.log(`✅ Updated driver ${driverId} location in memory`);
//         }
        
//         // CRITICAL: Broadcast to ALL connected users in REAL-TIME
//         io.emit("driverLiveLocationUpdate", {
//           driverId: driverId,
//           lat: latitude,
//           lng: longitude,
//           status: status || "Live",
//           vehicleType: "taxi",
//           timestamp: Date.now()
//         });
        
//         console.log(`📡 Broadcasted driver ${driverId} location to ALL users`);
        
//         // Also update database
//         const driverData = activeDriverSockets.get(driverId);
//         await saveDriverLocationToDB(
//           driverId, 
//           driverData?.driverName || "Unknown", 
//           latitude, 
//           longitude, 
//           "taxi", 
//           status || "Live"
//         );
        
//       } catch (error) {
//         console.error("❌ Error processing driver location update:", error);
//       }
//     });
    
//     // -------------------- DRIVER LIVE LOCATION UPDATE (IMPROVED) --------------------
//     socket.on("driverLiveLocationUpdate", async ({ driverId, driverName, lat, lng }) => {
//       try {
//         if (activeDriverSockets.has(driverId)) {
//           const driverData = activeDriverSockets.get(driverId);
//           driverData.location = { latitude: lat, longitude: lng };
//           driverData.lastUpdate = Date.now();
//           driverData.isOnline = true;
//           activeDriverSockets.set(driverId, driverData);
          
//           console.log(`\n📍 DRIVER LOCATION UPDATE: ${driverName} (${driverId})`);
//           console.log(`🗺️  New location: ${lat}, ${lng}`);
          
//           // Save to database immediately
//           await saveDriverLocationToDB(driverId, driverName, lat, lng, driverData.vehicleType);
          
//           // CRITICAL: Broadcast real-time update to ALL users
//           io.emit("driverLiveLocationUpdate", {
//             driverId: driverId,
//             lat: lat,
//             lng: lng,
//             status: driverData.status,
//             vehicleType: driverData.vehicleType,
//             timestamp: Date.now()
//           });
          
//           console.log(`📡 Real-time update broadcasted for driver ${driverId}`);
//         }
//       } catch (error) {
//         console.error("❌ Error updating driver location:", error);
//       }
//     });
    
//     // ========== END OF REAL-TIME BROADCASTING CODE ==========
    
//     // -------------------- USER REGISTRATION (ENHANCED) --------------------
//     socket.on('registerUser', ({ userId, userMobile }) => {
//       if (!userId) {
//         console.error('❌ No userId provided for user registration');
//         return;
//       }
      
//       socket.userId = userId.toString();
//       socket.join(userId.toString());
      
//       console.log(`👤 USER REGISTERED SUCCESSFULLY:`);
//       console.log(`   User ID: ${userId}`);
//       console.log(`   Mobile: ${userMobile || 'Not provided'}`);
//       console.log(`   Socket ID: ${socket.id}`);
//       console.log(`   Room: ${userId.toString()}`);
//     });
    
//     // -------------------- DRIVER REGISTRATION (WITH DEBUG) --------------------
//     socket.on("registerDriver", async ({ driverId, driverName, latitude, longitude, vehicleType = "taxi" }) => {
//       try {
//         console.log(`\n📝 DRIVER REGISTRATION ATTEMPT RECEIVED:`);
//         console.log(`   Driver ID: ${driverId}`);
//         console.log(`   Driver Name: ${driverName}`);
//         console.log(`   Location: ${latitude}, ${longitude}`);
//         console.log(`   Vehicle: ${vehicleType}`);
//         console.log(`   Socket ID: ${socket.id}`);
        
//         if (!driverId) {
//           console.log("❌ Registration failed: No driverId provided");
//           return;
//         }
        
//         if (!latitude || !longitude) {
//           console.log("❌ Registration failed: Invalid location");
//           return;
//         }

//         socket.driverId = driverId;
//         socket.driverName = driverName;
        
//         // Store driver connection info
//         activeDriverSockets.set(driverId, {
//           socketId: socket.id,
//           driverId,
//           driverName,
//           location: { latitude, longitude },
//           vehicleType,
//           lastUpdate: Date.now(),
//           status: "Live",
//           isOnline: true
//         });
        
//         // Join driver to rooms
//         socket.join("allDrivers");
//         socket.join(`driver_${driverId}`);
        
//         console.log(`✅ DRIVER REGISTERED SUCCESSFULLY: ${driverName} (${driverId})`);
//         console.log(`📍 Location: ${latitude}, ${longitude}`);
//         console.log(`🚗 Vehicle: ${vehicleType}`);
//         console.log(`🔌 Socket ID: ${socket.id}`);
        
//         // Save initial location to database
//         await saveDriverLocationToDB(driverId, driverName, latitude, longitude, vehicleType);
        
//         // Broadcast updated driver list to ALL connected users
//         broadcastDriverLocationsToAllUsers();
        
//         // Send confirmation to driver
//         socket.emit("driverRegistrationConfirmed", {
//           success: true,
//           message: "Driver registered successfully"
//         });
        
//         // Log current status
//         logDriverStatus();
        
//       } catch (error) {
//         console.error("❌ Error registering driver:", error);
        
//         // Send error to driver
//         socket.emit("driverRegistrationConfirmed", {
//           success: false,
//           message: "Registration failed: " + error.message
//         });
//       }
//     });

//     // -------------------- REQUEST NEARBY DRIVERS --------------------
//     socket.on("requestNearbyDrivers", ({ latitude, longitude, radius = 5000 }) => {
//       try {
//         console.log(`\n🔍 USER REQUESTED NEARBY DRIVERS: ${socket.id}`);
//         console.log(`📍 User location: ${latitude}, ${longitude}`);
//         console.log(`📏 Search radius: ${radius}m`);

//         // Get all active drivers (only those who are online)
//         const drivers = Array.from(activeDriverSockets.values())
//           .filter(driver => driver.isOnline)
//           .map(driver => ({
//             driverId: driver.driverId,
//             name: driver.driverName,
//             location: {
//               coordinates: [driver.location.longitude, driver.location.latitude]
//             },
//             vehicleType: driver.vehicleType,
//             status: driver.status,
//             lastUpdate: driver.lastUpdate
//           }));

//         console.log(`📊 Active drivers in memory: ${activeDriverSockets.size}`);
//         console.log(`📊 Online drivers: ${drivers.length}`);
        
//         // Log each driver's details
//         drivers.forEach((driver, index) => {
//           console.log(`🚗 Driver ${index + 1}: ${driver.name} (${driver.driverId})`);
//           console.log(`   Location: ${driver.location.coordinates[1]}, ${driver.location.coordinates[0]}`);
//           console.log(`   Status: ${driver.status}`);
//           console.log(`   Online: ${activeDriverSockets.get(driver.driverId)?.isOnline}`);
//         });

//         console.log(`📤 Sending ${drivers.length} online drivers to user`);

//         // Send to the requesting client only
//         socket.emit("nearbyDriversResponse", { drivers });
//       } catch (error) {
//         console.error("❌ Error fetching nearby drivers:", error);
//         socket.emit("nearbyDriversResponse", { drivers: [] });
//       }
//     });

//     // -------------------- BOOK RIDE --------------------
//     socket.on("bookRide", async (data, callback) => {
//       let rideId;
//       try {
//         const { userId, customerId, userName, userMobile, pickup, drop, vehicleType, estimatedPrice, distance, travelTime, wantReturn } = data;

//         console.log('📥 Received bookRide request with data:', JSON.stringify(data, null, 2));

//         // Generate sequential RAID_ID on backend
//         rideId = await generateSequentialRaidId();
//         console.log(`🆔 Generated RAID_ID: ${rideId}`);
        
//         console.log(`\n🚕 NEW RIDE BOOKING REQUEST: ${rideId}`);
//         console.log(`👤 User ID: ${userId}`);
//         console.log(`👤 Customer ID: ${customerId}`);
//         console.log(`👤 Name: ${userName}`);
//         console.log(`📱 Mobile: ${userMobile}`);
//         console.log(`📍 Pickup: ${JSON.stringify(pickup)}`);
//         console.log(`📍 Drop: ${JSON.stringify(drop)}`);
//         console.log(`🚗 Vehicle type: ${vehicleType}`);

//         // Generate OTP from customer ID (last 4 digits)
//         let otp;
//         if (customerId && customerId.length >= 4) {
//           otp = customerId.slice(-4);
//         } else {
//           otp = Math.floor(1000 + Math.random() * 9000).toString();
//         }
//         console.log(`🔢 OTP: ${otp}`);

//         // Check if this ride is already being processed
//         if (processingRides.has(rideId)) {
//           console.log(`⏭️  Ride ${rideId} is already being processed, skipping`);
//           if (callback) {
//             callback({
//               success: false,
//               message: "Ride is already being processed"
//             });
//           }
//           return;
//         }
        
//         // Add to processing set
//         processingRides.add(rideId);

//         // Validate required fields
//         if (!userId || !customerId || !userName || !pickup || !drop) {
//           console.error("❌ Missing required fields");
//           processingRides.delete(rideId);
//           if (callback) {
//             callback({
//               success: false,
//               message: "Missing required fields"
//             });
//           }
//           return;
//         }

//         // Check if ride with this ID already exists in database
//         const existingRide = await Ride.findOne({ RAID_ID: rideId });
//         if (existingRide) {
//           console.log(`⏭️  Ride ${rideId} already exists in database, skipping`);
//           processingRides.delete(rideId);
//           if (callback) {
//             callback({
//               success: true,
//               rideId: rideId,
//               _id: existingRide._id.toString(),
//               otp: existingRide.otp,
//               message: "Ride already exists"
//             });
//           }
//           return;
//         }

//         // Create a new ride document in MongoDB
//         const rideData = {
//           user: userId,
//           customerId: customerId,
//           name: userName,
//           RAID_ID: rideId,
//           pickupLocation: pickup.address || "Selected Location",
//           dropoffLocation: drop.address || "Selected Location",
//           pickupCoordinates: {
//             latitude: pickup.lat,
//             longitude: pickup.lng
//           },
//           dropoffCoordinates: {
//             latitude: drop.lat,
//             longitude: drop.lng
//           },
//           fare: estimatedPrice || 0,
//           rideType: vehicleType,
//           otp: otp,
//           distance: distance || "0 km",
//           travelTime: travelTime || "0 mins",
//           isReturnTrip: wantReturn || false,
//           status: "pending",
//           Raid_date: new Date(),
//           Raid_time: new Date().toLocaleTimeString('en-US', { 
//             timeZone: 'Asia/Kolkata', 
//             hour12: true 
//           }),
//           pickup: {
//             addr: pickup.address || "Selected Location",
//             lat: pickup.lat,
//             lng: pickup.lng,
//           },
//           drop: {
//             addr: drop.address || "Selected Location",
//             lat: drop.lat,
//             lng: drop.lng,
//           },
//           price: estimatedPrice || 0,
//           distanceKm: parseFloat(distance) || 0
//         };

//         console.log('💾 Ride data to be saved:', JSON.stringify(rideData, null, 2));

//         // Create and save the ride
//         const newRide = new Ride(rideData);
        
//         // Validate the document before saving
//         try {
//           await newRide.validate();
//           console.log('✅ Document validation passed');
//         } catch (validationError) {
//           console.error('❌ Document validation failed:', validationError);
//           throw validationError;
//         }

//         // Save to MongoDB
//         const savedRide = await newRide.save();
//         console.log(`💾 Ride saved to MongoDB with ID: ${savedRide._id}`);
//         console.log(`💾 RAID_ID in saved document: ${savedRide.RAID_ID}`);

//         // Store ride data in memory for socket operations
//         rides[rideId] = {
//           ...data,
//           rideId: rideId,
//           status: "pending",
//           timestamp: Date.now(),
//           _id: savedRide._id.toString()
//         };

//         // Broadcast to all drivers
//         io.emit("newRideRequest", {
//           ...data,
//           rideId: rideId,
//           _id: savedRide._id.toString()
//         });

//         // Send success response with backend-generated rideId
//         if (callback) {
//           callback({
//             success: true,
//             rideId: rideId,
//             _id: savedRide._id.toString(),
//             otp: otp,
//             message: "Ride booked successfully!"
//           });
//         }

//         console.log(`📡 Ride request broadcasted to all drivers with ID: ${rideId}`);
//         console.log(`💾 Ride saved to MongoDB with ID: ${savedRide._id}`);

//         // Log current status
//         logRideStatus();

//       } catch (error) {
//         console.error("❌ Error booking ride:", error);
        
//         // Handle specific validation errors
//         if (error.name === 'ValidationError') {
//           const errors = Object.values(error.errors).map(err => err.message);
//           console.error("❌ Validation errors:", errors);
          
//           if (callback) {
//             callback({
//               success: false,
//               message: `Validation failed: ${errors.join(', ')}`
//             });
//           }
//         } 
//         // Handle duplicate key error
//         else if (error.code === 11000 && error.keyPattern && error.keyPattern.RAID_ID) {
//           console.log(`🔄 Duplicate RAID_ID detected: ${rideId}`);
          
//           try {
//             // Try to find the existing ride
//             const existingRide = await Ride.findOne({ RAID_ID: rideId });
//             if (existingRide && callback) {
//               callback({
//                 success: true,
//                 rideId: rideId,
//                 _id: existingRide._id.toString(),
//                 otp: existingRide.otp,
//                 message: "Ride already exists (duplicate handled)"
//               });
//             }
//           } catch (findError) {
//             console.error("❌ Error finding existing ride:", findError);
//             if (callback) {
//               callback({
//                 success: false,
//                 message: "Failed to process ride booking (duplicate error)"
//               });
//             }
//           }
//         } else {
//           if (callback) {
//             callback({
//               success: false,
//               message: "Failed to process ride booking"
//             });
//           }
//         }
//       } finally {
//         // Always remove from processing set
//         if (rideId) {
//           processingRides.delete(rideId);
//         }
//       }
//     });


// // ✅ ADD THIS TO BACKEND socket.js - Room management
// socket.on('joinRoom', async (data) => {
//   try {
//     const { userId } = data;
//     if (userId) {
//       socket.join(userId.toString());
//       console.log(`✅ User ${userId} joined their room via joinRoom event`);
//     }
//   } catch (error) {
//     console.error('Error in joinRoom:', error);
//   }
// });

// // ✅ ENHANCE the existing registerUser handler
// socket.on('registerUser', async ({ userId, userMobile }) => {
//   if (!userId) {
//     console.error('❌ No userId provided for user registration');
//     return;
//   }
  
//   socket.userId = userId.toString();
//   socket.join(userId.toString());
  
//   console.log(`👤 USER REGISTERED & ROOM JOINED:`);
//   console.log(`   User ID: ${userId}`);
//   console.log(`   Mobile: ${userMobile || 'Not provided'}`);
//   console.log(`   Socket ID: ${socket.id}`);
//   console.log(`   Room: ${userId.toString()}`);
//   console.log(`   All rooms:`, Array.from(socket.rooms));
// });


// // ✅ BULLETPROOF RIDE ACCEPTANCE HANDLER
// socket.on("acceptRide", async (data, callback) => {
//   const { rideId, driverId, driverName } = data;

//   console.log("🚨 ===== BACKEND ACCEPT RIDE START =====");
//   console.log("📥 Acceptance Data:", { rideId, driverId, driverName });
//   console.log("🚨 ===== BACKEND ACCEPT RIDE END =====");

//   try {
//     // ✅ 1. FIND RIDE IN DATABASE
//     console.log(`🔍 Looking for ride: ${rideId}`);
//     const ride = await Ride.findOne({ RAID_ID: rideId });
    
//     if (!ride) {
//       console.error(`❌ Ride ${rideId} not found in database`);
//       if (typeof callback === "function") {
//         callback({ success: false, message: "Ride not found" });
//       }
//       return;
//     }

//     console.log(`✅ Found ride: ${ride.RAID_ID}, Status: ${ride.status}`);

//     // ✅ 2. CHECK IF RIDE IS ALREADY ACCEPTED
//     if (ride.status === "accepted") {
//       console.log(`🚫 Ride ${rideId} already accepted by: ${ride.driverId}`);
      
//       // Notify all drivers
//       socket.broadcast.emit("rideAlreadyAccepted", { 
//         rideId,
//         message: "This ride has already been accepted by another driver."
//       });
      
//       if (typeof callback === "function") {
//         callback({ 
//           success: false, 
//           message: "This ride has already been accepted by another driver." 
//         });
//       }
//       return;
//     }

//     // ✅ 3. UPDATE RIDE STATUS
//     console.log(`🔄 Updating ride status to 'accepted'`);
//     ride.status = "accepted";
//     ride.driverId = driverId;
//     ride.driverName = driverName;

//     // ✅ 4. GET DRIVER DETAILS
//     const driver = await Driver.findOne({ driverId });
//     console.log(`👨‍💼 Driver details:`, driver ? "Found" : "Not found");
    
//     if (driver) {
//       ride.driverMobile = driver.phone;
//       console.log(`📱 Driver mobile: ${driver.phone}`);
//     } else {
//       ride.driverMobile = "N/A";
//       console.log(`⚠️ Driver not found in Driver collection`);
//     }

//     // ✅ 5. ENSURE OTP EXISTS
//     if (!ride.otp) {
//       const otp = Math.floor(1000 + Math.random() * 9000).toString();
//       ride.otp = otp;
//       console.log(`🔢 Generated new OTP: ${otp}`);
//     } else {
//       console.log(`🔢 Using existing OTP: ${ride.otp}`);
//     }

//     // ✅ 6. SAVE TO DATABASE
//     await ride.save();
//     console.log(`💾 Ride saved successfully`);

//     // ✅ 7. PREPARE DRIVER DATA FOR USER
//     const driverData = {
//       success: true,
//       rideId: ride.RAID_ID,
//       driverId: driverId,
//       driverName: driverName,
//       driverMobile: ride.driverMobile,
//       driverLat: driver?.location?.coordinates?.[1] || 0,
//       driverLng: driver?.location?.coordinates?.[0] || 0,
//       otp: ride.otp,
//       pickup: ride.pickup,
//       drop: ride.drop,
//       status: ride.status,
//       vehicleType: driver?.vehicleType || "taxi",
//       timestamp: new Date().toISOString()
//     };

//     console.log("📤 Prepared driver data:", JSON.stringify(driverData, null, 2));

//     // ✅ 8. SEND CONFIRMATION TO DRIVER
//     if (typeof callback === "function") {
//       console.log("📨 Sending callback to driver");
//       callback(driverData);
//     }

// // ✅ ENHANCED: Multiple emission methods in backend
// // In your acceptRide handler, replace the notification section with:

// // ✅ 9. NOTIFY USER WITH MULTIPLE CHANNELS
// const userRoom = ride.user.toString();
// console.log(`📡 Notifying user room: ${userRoom}`);
// console.log(`🔍 All rooms for user:`, Array.from(io.sockets.adapter.rooms.get(userRoom) || []));

// // Method 1: Standard room emission
// io.to(userRoom).emit("rideAccepted", driverData);
// console.log("✅ Notification sent via standard room channel");

// // Method 2: Direct to all sockets in room
// const userSockets = await io.in(userRoom).fetchSockets();
// console.log(`🔍 Found ${userSockets.length} sockets in user room`);
// userSockets.forEach((userSocket, index) => {
//   userSocket.emit("rideAccepted", driverData);
//   console.log(`✅ Notification sent to user socket ${index + 1}: ${userSocket.id}`);
// });

// // Method 3: Global emit with user filter (for debugging)
// io.emit("rideAcceptedGlobal", {
//   ...driverData,
//   targetUserId: userRoom,
//   timestamp: new Date().toISOString()
// });
// console.log("✅ Global notification sent with user filter");

// // Method 4: Backup delayed emission
// setTimeout(() => {
//   io.to(userRoom).emit("rideAccepted", driverData);
//   console.log("✅ Backup notification sent after delay");
// }, 1000);




//     // Channel 3: Global broadcast with identifier
//     io.emit("rideAcceptedBroadcast", {
//       ...driverData,
//       targetUserId: ride.user.toString()
//     });
//     console.log("✅ Global broadcast sent");

//     // ✅ 10. NOTIFY OTHER DRIVERS
//     socket.broadcast.emit("rideAlreadyAccepted", { 
//       rideId,
//       message: "This ride has already been accepted by another driver."
//     });
//     console.log("📢 Other drivers notified");

//     // ✅ 11. UPDATE DRIVER STATUS IN MEMORY
//     if (activeDriverSockets.has(driverId)) {
//       const driverInfo = activeDriverSockets.get(driverId);
//       driverInfo.status = "onRide";
//       driverInfo.isOnline = true;
//       activeDriverSockets.set(driverId, driverInfo);
//       console.log(`🔄 Updated driver ${driverId} status to 'onRide'`);
//     }

//     console.log(`🎉 RIDE ${rideId} ACCEPTED SUCCESSFULLY BY ${driverName}`);

//   } catch (error) {
//     console.error(`❌ ERROR ACCEPTING RIDE ${rideId}:`, error);
//     console.error("Stack:", error.stack);
    
//     if (typeof callback === "function") {
//       callback({ 
//         success: false, 
//         message: "Server error: " + error.message 
//       });
//     }
//   }
// });


// // ✅ ENHANCED: Add these event handlers in socket.js

// // Handle getDriverData requests
// socket.on("getDriverData", async (data) => {
//   try {
//     const { rideId } = data;
//     console.log(`🚗 Driver data requested for ride: ${rideId}`);
    
//     const ride = await Ride.findOne({ RAID_ID: rideId });
//     if (!ride || !ride.driverId) {
//       socket.emit("driverDataResponse", { 
//         success: false, 
//         message: "No driver assigned" 
//       });
//       return;
//     }
    
//     const driver = await Driver.findOne({ driverId: ride.driverId });
//     const driverData = {
//       success: true,
//       rideId: ride.RAID_ID,
//       driverId: ride.driverId,
//       driverName: ride.driverName,
//       driverMobile: ride.driverMobile,
//       driverLat: driver?.location?.coordinates?.[1] || 0,
//       driverLng: driver?.location?.coordinates?.[0] || 0,
//       otp: ride.otp,
//       pickup: ride.pickup,
//       drop: ride.drop,
//       status: ride.status,
//       vehicleType: driver?.vehicleType || "taxi"
//     };
    
//     console.log(`📤 Sending driver data for ${rideId}`);
//     socket.emit("driverDataResponse", driverData);
    
//   } catch (error) {
//     console.error("Error getting driver data:", error);
//     socket.emit("driverDataResponse", { 
//       success: false, 
//       message: error.message 
//     });
//   }
// });

// // Handle getRideStatus requests
// socket.on("getRideStatus", async (data) => {
//   try {
//     const { rideId } = data;
//     console.log(`📋 Ride status requested: ${rideId}`);
    
//     const ride = await Ride.findOne({ RAID_ID: rideId });
//     if (!ride) {
//       socket.emit("rideStatusResponse", { 
//         success: false, 
//         message: "Ride not found" 
//       });
//       return;
//     }
    
//     const response = {
//       success: true,
//       rideId: ride.RAID_ID,
//       status: ride.status,
//       driverId: ride.driverId,
//       driverName: ride.driverName,
//       driverMobile: ride.driverMobile
//     };
    
//     // If ride is accepted, include driver location
//     if (ride.status === "accepted" && ride.driverId) {
//       const driver = await Driver.findOne({ driverId: ride.driverId });
//       if (driver) {
//         response.driverLat = driver.location.coordinates[1];
//         response.driverLng = driver.location.coordinates[0];
//         response.vehicleType = driver.vehicleType;
//       }
//     }
    
//     console.log(`📤 Sending ride status for ${rideId}`);
//     socket.emit("rideStatusResponse", response);
    
//   } catch (error) {
//     console.error("Error getting ride status:", error);
//     socket.emit("rideStatusResponse", { 
//       success: false, 
//       message: error.message 
//     });
//   }
// });





//     // -------------------- REJECT RIDE --------------------
//     socket.on("rejectRide", (data) => {
//       try {
//         const { rideId, driverId } = data;
        
//         console.log(`\n❌ RIDE REJECTED: ${rideId}`);
//         console.log(`🚗 Driver: ${driverId}`);
        
//         if (rides[rideId]) {
//           rides[rideId].status = "rejected";
//           rides[rideId].rejectedAt = Date.now();
          
//           // Update driver status back to online
//           if (activeDriverSockets.has(driverId)) {
//             const driverData = activeDriverSockets.get(driverId);
//             driverData.status = "Live";
//             driverData.isOnline = true;
//             activeDriverSockets.set(driverId, driverData);
            
//             socket.emit("driverStatusUpdate", {
//               driverId,
//               status: "Live"
//             });
//           }
          
//           logRideStatus();
//         }
//       } catch (error) {
//         console.error("❌ Error rejecting ride:", error);
//       }
//     });
    
//     // -------------------- COMPLETE RIDE --------------------
//     socket.on("completeRide", (data) => {
//       try {
//         const { rideId, driverId, distance } = data;
        
//         console.log(`\n🎉 RIDE COMPLETED: ${rideId}`);
//         console.log(`🚗 Driver: ${driverId}`);
//         console.log(`📏 Distance: ${distance.toFixed(2)} km`);
        
//         if (rides[rideId]) {
//           rides[rideId].status = "completed";
//           rides[rideId].completedAt = Date.now();
//           rides[rideId].distance = distance;
          
//           // Notify the user
//           const userId = rides[rideId].userId;
//           io.to(userId).emit("rideCompleted", {
//             rideId,
//             distance
//           });
          
//           // Update driver status back to online
//           if (activeDriverSockets.has(driverId)) {
//             const driverData = activeDriverSockets.get(driverId);
//             driverData.status = "Live";
//             driverData.isOnline = true;
//             activeDriverSockets.set(driverId, driverData);
            
//             socket.emit("driverStatusUpdate", {
//               driverId,
//               status: "Live"
//             });
//           }
          
//           // Remove ride after 5 seconds
//           setTimeout(() => {
//             delete rides[rideId];
//             console.log(`🗑️  Removed completed ride: ${rideId}`);
//           }, 5000);
          
//           logRideStatus();
//         }
//       } catch (error) {
//         console.error("❌ Error completing ride:", error);
//       }
//     });

    
    
//     // -------------------- DRIVER HEARTBEAT --------------------
//     socket.on("driverHeartbeat", ({ driverId }) => {
//       if (activeDriverSockets.has(driverId)) {
//         const driverData = activeDriverSockets.get(driverId);
//         driverData.lastUpdate = Date.now();
//         driverData.isOnline = true;
//         activeDriverSockets.set(driverId, driverData);
        
//         console.log(`❤️  Heartbeat received from driver: ${driverId}`);
//       }
//     });
    
//     // -------------------- DISCONNECT --------------------
//     socket.on("disconnect", () => {
//       console.log(`\n❌ Client disconnected: ${socket.id}`);
//       console.log(`📱 Remaining connected clients: ${io.engine.clientsCount - 1}`);
      
//       if (socket.driverId) {
//         console.log(`🛑 Driver ${socket.driverName} (${socket.driverId}) disconnected`);
        
//         // Mark driver as offline but keep in memory for a while
//         if (activeDriverSockets.has(socket.driverId)) {
//           const driverData = activeDriverSockets.get(socket.driverId);
//           driverData.isOnline = false;
//           driverData.status = "Offline";
//           activeDriverSockets.set(socket.driverId, driverData);
          
//           saveDriverLocationToDB(
//             socket.driverId, 
//             socket.driverName,
//             driverData.location.latitude, 
//             driverData.location.longitude, 
//             driverData.vehicleType,
//             "Offline"
//           ).catch(console.error);
//         }
        
//         broadcastDriverLocationsToAllUsers();
//         logDriverStatus();
//       }
//     });
//   });
  
//   // Clean up ONLY offline drivers every 60 seconds
//   setInterval(() => {
//     const now = Date.now();
//     const fiveMinutesAgo = now - 300000;
//     let cleanedCount = 0;
    
//     Array.from(activeDriverSockets.entries()).forEach(([driverId, driver]) => {
//       if (!driver.isOnline && driver.lastUpdate < fiveMinutesAgo) {
//         activeDriverSockets.delete(driverId);
//         cleanedCount++;
//         console.log(`🧹 Removed offline driver (5+ minutes): ${driver.driverName} (${driverId})`);
//       }
//     });
    
//     if (cleanedCount > 0) {
//       console.log(`\n🧹 Cleaned up ${cleanedCount} offline drivers`);
//       broadcastDriverLocationsToAllUsers();
//       logDriverStatus();
//     }
//   }, 60000);
// };

// // -------------------- GET IO INSTANCE --------------------
// const getIO = () => {
//   if (!io) throw new Error("❌ Socket.io not initialized!");
//   return io;
// };

// module.exports = { init, getIO };