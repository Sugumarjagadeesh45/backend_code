// D:\newapp\fullbackend-main\fullbackend-main_\models\driver\driver.js
const mongoose = require("mongoose");
const driverSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ["Live", "Offline"], default: "Offline" },
    vehicleType: { type: String },
    // 👇 Proper GeoJSON location field
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    active: { type: Boolean, default: false },
    totalPayment: { type: Number, default: 0 },
    settlement: { type: Number, default: 0 },
    hoursLive: { type: Number, default: 0 },
    dailyHours: { type: Number, default: 0 },
    dailyRides: { type: Number, default: 0 },
    loginTime: { type: String },
    earnings: { type: Number, default: 0 },
    logoutTime: { type: String },
    mustChangePassword: { type: Boolean, default: true },
    lastUpdate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ✅ Add 2dsphere index
driverSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Driver", driverSchema);



// const mongoose = require("mongoose");

// const driverSchema = new mongoose.Schema(
//   {
//     driverId: { type: String, required: true, unique: true },
//     name: { type: String, required: true },
//     phone: { type: String, required: true, unique: true },
//     passwordHash: { type: String, required: true },
//     status: { type: String, enum: ["Live", "Offline"], default: "Offline" },
//     vehicleType: { type: String },

//     // 👇 Proper GeoJSON location field
//     location: {
//       type: { type: String, enum: ["Point"], default: "Point" },
//       coordinates: { type: [Number], required: true }, // [longitude, latitude]
//     },

//     active: { type: Boolean, default: false },
//     totalPayment: { type: Number, default: 0 },
//     settlement: { type: Number, default: 0 },
//     hoursLive: { type: Number, default: 0 },
//     dailyHours: { type: Number, default: 0 },
//     dailyRides: { type: Number, default: 0 },
//     loginTime: { type: String },
//     earnings: { type: Number, default: 0 },
//     logoutTime: { type: String },
//     mustChangePassword: { type: Boolean, default: true },
//   },
//   { timestamps: true }
// );

// // ✅ Add 2dsphere index
// driverSchema.index({ location: "2dsphere" });

// module.exports = mongoose.model("Driver", driverSchema);
