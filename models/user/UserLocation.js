const mongoose = require('mongoose');

const userLocationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Registration', 
    required: true 
  },
  rideId: { 
    type: String, 
    default: null 
  },
  latitude: { 
    type: Number, 
    required: true 
  },
  longitude: { 
    type: Number, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Index for faster queries
userLocationSchema.index({ userId: 1, timestamp: -1 });
userLocationSchema.index({ rideId: 1 });

module.exports = mongoose.model('UserLocation', userLocationSchema);