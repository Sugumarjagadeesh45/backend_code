const User = require('../models/User');
const jwt = require('jsonwebtoken');

const otpStore = {}; // Temporary in-memory store { phone: { otp, expiresAt } }

// Request OTP (mock)
exports.requestOtp = async (req, res) => {
  try {
    const { phone, name, email } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore[phone] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 }; // 5 min expiry

    console.log(`Mock OTP for ${phone}: ${otp}`);

    // Create user if not exists
    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({ phone, name, email });
    }

    res.json({ message: 'OTP sent successfully (mock)', phone });
  } catch (error) {
    console.error('Request OTP Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Verify OTP -> Return JWT
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

    const rec = otpStore[phone];
    if (!rec || rec.otp !== otp || rec.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    delete otpStore[phone]; // Remove OTP after use

    res.json({ token, user });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};