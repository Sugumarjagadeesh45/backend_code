
const Registration = require('../models/user/Registration');
const Location = require('../models/user/location');
const Ride = require('../models/ride');
const RaidId = require('../models/user/raidId');
const jwt = require('jsonwebtoken');

const path = require('path');

// Update user profile
// D:\newapp\fullbackend-main\fullbackend-main_\controllers\userController.js

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, address, altMobile, gender, dob } = req.body;
    const userId = req.user.id;
    
    console.log('📝 Updating profile for user:', userId);
    console.log('📝 Update data:', req.body);
    if (req.file) {
      console.log('📝 Profile picture file:', req.file);
      console.log('📝 Profile picture path:', req.file.path);
    }
    
    let user = await Registration.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (address !== undefined) user.address = address;
    if (altMobile !== undefined) user.altMobile = altMobile;
    if (gender !== undefined) user.gender = gender;
    if (dob !== undefined) user.dob = dob;
    
    // If there's a profile picture, update it with proper path
    if (req.file) {
      // Store just the filename, not the full path
      user.profilePicture = `/uploads/${req.file.filename}`;
      console.log('📷 Updated profile picture path:', user.profilePicture);
    }
    
    await user.save();
    console.log('✅ User updated successfully');
    
    // Format the response properly
    const formattedUser = {
      _id: user._id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      customerId: user.customerId,
      email: user.email || '',
      address: user.address,
      profilePicture: user.profilePicture || '',
      gender: user.gender || '',
      dob: user.dob || '',
      altMobile: user.altMobile || '',
      wallet: user.wallet || 0
    };
    
    res.json({ success: true, user: formattedUser });
  } catch (err) {
    console.error('❌ Error updating profile:', err);
    res.status(500).json({ error: err.message });
  }
};


// Middleware for token authentication
exports.authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    console.log('❌ No authorization header provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = header.split(' ')[1];
  if (!token) {
    console.log('❌ No token found in authorization header');
    return res.status(401).json({ error: 'Token malformed' });
  }
  
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    console.log('✅ Token verified successfully for user ID:', data.id);
    req.user = data;
    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

exports.saveUserLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      console.log('❌ Missing latitude or longitude in request');
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    console.log("🌐 Frontend to received location code:", { latitude, longitude, userId: req.user.id });
    
    const newLocation = new Location({ 
      latitude, 
      longitude, 
      userId: req.user.id 
    });
    
    const savedLocation = await newLocation.save();
    console.log("✅ Location saved to MongoDB:", savedLocation);
    console.log("✅ Backend to send location code:", savedLocation);
    
    res.json({
      message: 'Location saved successfully',
      location: savedLocation
    });
  } catch (err) {
    console.error("❌ Error saving location:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Get last saved location
exports.getLastUserLocation = async (req, res) => {
  try {
    console.log("🔍 Backend: Fetching last location for user:", req.user.id);
    const lastLocation = await Location.findOne({ userId: req.user.id }).sort({ timestamp: -1 });
    if (!lastLocation) {
      console.log('❌ No location found for user:', req.user.id);
      return res.status(404).json({ message: 'No location found' });
    }
    console.log("✅ Backend to send location code:", lastLocation);
    res.json(lastLocation);
  } catch (err) {
    console.error("❌ Error fetching location:", err.message);
    res.status(500).json({ error: err.message });
  }
};




// Get all saved locations
exports.getAllUserLocations = async (req, res) => {
  try {
    const allLocations = await Location.find({ userId: req.user.id }).sort({ timestamp: -1 });
    res.json(allLocations);
  } catch (err) {
    console.error("❌ Error fetching locations:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Get profile
exports.getProfile = async (req, res) => {
  try {
    const user = await Registration.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error("❌ Error fetching profile:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Get wallet
exports.getWallet = async (req, res) => {
  try {
    const user = await Registration.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.wallet);
  } catch (err) {
    console.error("❌ Error fetching wallet:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const users = await Registration.find();
    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const user = new Registration(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    console.error("❌ Error creating user:", err.message);
    res.status(400).json({ error: err.message });
  }
};

// Register new user
exports.registerUser = async (req, res) => {
  try {
    const { name, phoneNumber, address, email, gender, dob, altMobile } = req.body;

    // Check if phoneNumber or email already exists
    const existingPhone = await Registration.findOne({ phoneNumber });
    if (existingPhone) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const registration = new Registration({
      name,
      phoneNumber,
      address
    });

    await registration.save();
    res.status(201).json({ message: 'Registration successful', data: registration });
  } catch (err) {
    console.error("❌ Error registering user:", err.message);
    res.status(400).json({ error: err.message });
  }
};

// Get all registered users for admin panel
exports.getAllRegisteredUsers = async (req, res) => {
  try {
    console.log('📋 Fetching all registered users...');
    const registeredUsers = await Registration.find().sort({ createdAt: -1 });
    
    console.log(`✅ Found ${registeredUsers.length} registered users`);
    
    res.json({
      success: true,
      count: registeredUsers.length,
      data: registeredUsers
    });
  } catch (err) {
    console.error("❌ Error fetching registered users:", err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch registered users',
      details: err.message
    });
  }
};

// Get specific registered user by ID
exports.getRegisteredUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Registration.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error("❌ Error fetching user:", err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch user' 
    });
  }
};

// Book a ride
exports.bookRide = async (req, res) => {
  try {
    console.log('🔍 Booking request received:', req.body);
    
    const {
      pickupLocation,
      dropoffLocation,
      pickupCoordinates,
      dropoffCoordinates,
      fare,
      rideType,
      otp,
      distance,
      travelTime,
      isReturnTrip
    } = req.body;
    
    if (!pickupLocation || !dropoffLocation || !pickupCoordinates || 
        !dropoffCoordinates || !fare || !rideType || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required booking information'
      });
    }
    
    const counter = await RaidId.findOneAndUpdate(
      { _id: 'raidId' },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );
    const RAID_ID = counter.sequence.toString().padStart(6, '0');
    
    const user = await Registration.findById(req.user.id);
    if (!user || !user.customerId) {
      return res.status(404).json({ success: false, error: 'User or customerId not found' });
    }
    
    // Log required details
    console.log(`
      🚕 NEW RIDE BOOKING: ${RAID_ID}
      👤 Customer ID: ${user.customerId}
      👤 Customer Name: ${user.name}
      📍 Pickup Location: ${pickupLocation}
      📍 Dropoff Location: ${dropoffLocation}
      📏 Traveling Length: ${distance}
    `);
    
    const newRide = new Ride({
      user: req.user.id,
      customerId: user.customerId,
      name: user.name,
      RAID_ID,
      pickupLocation,
      dropoffLocation,
      pickupCoordinates,
      dropoffCoordinates,
      fare,
      rideType,
      otp,
      distance,
      travelTime,
      isReturnTrip,
      status: 'pending'
    });
    
    const savedRide = await newRide.save();
    console.log('✅ Ride booked successfully:', savedRide);
    
    const io = req.app.get('io');
    if (io) {
      const rideData = {
        rideId: savedRide._id.toString(),
        RAID_ID: savedRide.RAID_ID,
        customerId: savedRide.customerId,
        name: savedRide.name,
        pickup: {
          address: savedRide.pickupLocation,
          lat: savedRide.pickupCoordinates.latitude,
          lng: savedRide.pickupCoordinates.longitude
        },
        drop: {
          address: savedRide.dropoffLocation,
          lat: savedRide.dropoffCoordinates.latitude,
          lng: savedRide.dropoffCoordinates.longitude
        },
        fare: savedRide.fare,
        rideType: savedRide.rideType,
        distance: savedRide.distance,
        otp: savedRide.otp, // Include OTP in the emitted data
        success: true,
        timestamp: new Date()
      };
      
      console.log('📡 Emitting new ride request to all drivers:', rideData);
      io.to("allDrivers").emit("newRideRequest", rideData);
      io.emit("rideCreated", rideData); // Emit to the user
    } else {
      console.log('⚠️ Socket.io instance not available');
    }
    
    res.status(201).json({
      success: true,
      message: 'Ride booked successfully',
      ride: savedRide
    });
    
  } catch (err) {
    console.error("❌ Error booking ride:", err);
    res.status(500).json({
      success: false,
      error: 'Server error while booking ride'
    });
  }
};

// Get current user profile (updated implementation)
exports.getCurrentUserProfile = async (req, res) => {
  try {
    const user = await Registration.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Return in the format expected by frontend
    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        customerId: user.customerId,
        email: user.email || '',
        address: user.address,
        profilePicture: user.profilePicture || '',
        gender: user.gender || '',
        dob: user.dob || '',
        altMobile: user.altMobile || '',
        wallet: user.wallet || 0
      }
    });
  } catch (err) {
    console.error("❌ Error fetching current user profile:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};




// Get ride history (new implementation)
exports.getRideHistory = async (req, res) => {
  try {
    const rides = await Ride.find({ user: req.user.id }).sort({ Raid_date: -1 });
    res.json(rides);
  } catch (err) {
    console.error("❌ Error fetching ride history:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Create ride (new implementation, alias for bookRide if needed)
exports.createRide = async (req, res) => {
  // Reuse bookRide logic for now
  await exports.bookRide(req, res);
};

// Update ride status (new implementation)
exports.updateRideStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const ride = await Ride.findOne({ user: req.user.id, status: { $ne: 'completed' } });
    if (!ride) {
      return res.status(404).json({ error: 'No active ride found' });
    }

    ride.status = status;
    await ride.save();
    res.json({ message: 'Ride status updated', ride });
  } catch (err) {
    console.error("❌ Error updating ride status:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Add to wallet (new implementation)
exports.addToWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const user = await Registration.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.wallet += amount;
    await user.save();
    res.json({ message: 'Amount added to wallet', wallet: user.wallet });
  } catch (err) {
    console.error("❌ Error adding to wallet:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Deduct from wallet (new implementation)
exports.deductFromWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const user = await Registration.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.wallet < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    user.wallet -= amount;
    await user.save();
    res.json({ message: 'Amount deducted from wallet', wallet: user.wallet });
  } catch (err) {
    console.error("❌ Error deducting from wallet:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Update user (new implementation)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = await Registration.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error("❌ Error updating user:", err.message);
    res.status(400).json({ error: err.message });
  }
};

// Delete user (new implementation)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Registration.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error("❌ Error deleting user:", err.message);
    res.status(500).json({ error: err.message });
  }
};

