
const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
  customerId: { type: String, required: true },
  name: { type: String, required: true },
  RAID_ID: { 
    type: String, 
    required: [true, 'RAID_ID is required'],
    unique: true,
    validate: {
      validator: function(v) {
        return v !== null && v !== undefined && v.trim() !== '';
      },
      message: 'RAID_ID cannot be null or empty'
    }
  },
  pickupLocation: { type: String, required: true },
  dropoffLocation: { type: String, required: true },
  pickupCoordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  dropoffCoordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  fare: { type: Number, required: true },
  rideType: { type: String, enum: ['bike', 'taxi', 'port', 'mini', 'sedan', 'suv'], required: true },
  otp: { type: String, required: true },
  distance: { type: String, required: true },
  travelTime: { type: String, required: true },
  isReturnTrip: { type: Boolean, default: false },

  // 🚕 Updated ride status enum
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'arrived', 'ongoing', 'completed', 'cancelled'], 
    default: 'pending' 
  },

  Raid_date: { type: Date, default: Date.now },
  Raid_time: { 
    type: String, 
    default: () => new Date().toLocaleTimeString('en-US', { 
      timeZone: 'Asia/Kolkata', 
      hour12: true 
    }) 
  },

  // Added fields from friend's implementation
  pickup: {
    addr: String,
    lat: Number,
    lng: Number,
  },
  drop: {
    addr: String,
    lat: Number,
    lng: Number,
  },

  price: Number,
  distanceKm: Number

}, {
  timestamps: true
});

module.exports = mongoose.models.Ride || mongoose.model('Ride', rideSchema);
