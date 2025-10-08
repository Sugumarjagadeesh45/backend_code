const mongoose = require('mongoose');

const liveLocationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  accuracy: { type: Number, default: 0 }, // Optional: GPS accuracy in meters
  status: { type: String, enum: ['active', 'completed'], default: 'active' }
});

module.exports = mongoose.model('LiveLocation', liveLocationSchema);