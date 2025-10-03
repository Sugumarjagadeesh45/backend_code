
const mongoose = require('mongoose');
const Counter = require('./customerId'); // Assuming this is the counter model

const registrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  customerId: { type: String, required: true, unique: true },
  profilePicture: { type: String, default: '' },
  email: { type: String, default: '' },
  gender: { type: String, default: '' },
  dob: { type: Date, default: null },
  altMobile: { type: String, default: '' },
  wallet: { type: Number, default: 0 }
});

// Pre-save hook to generate customerId if not provided
registrationSchema.pre('save', async function(next) {
  if (this.isNew && !this.customerId) {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'customerId' },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );
    this.customerId = (100000 + counter.sequence).toString(); // Start from 100001
  }
  next();
});

module.exports = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);