// D:\newapp\fullbackend-main\fullbackend-main_\models\DriverLocation.js
const mongoose = require("mongoose");
const driverLocationSchema = new mongoose.Schema({
  driverId: {
    type: String,
    required: true,
    index: true
  },
  driverName: {
    type: String,
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  vehicleType: {
    type: String,
    default: "taxi"
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
status: {
    type: String,
    enum: ["offline", "online", "Live", "onRide"], // ✅ add onRide
    default: "offline",
  },
}, {
  timestamps: true
});

// Create TTL index to automatically delete documents after 24 hours
driverLocationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });

// Create compound index for efficient queries
driverLocationSchema.index({ driverId: 1, timestamp: -1 });

module.exports = mongoose.model("DriverLocation", driverLocationSchema);
