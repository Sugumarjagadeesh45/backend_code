// models/user/raidId.js
const mongoose = require('mongoose');

const raidIdSchema = new mongoose.Schema({
  _id: { type: String, default: 'raidId' },
  sequence: { type: Number, default: 100000 } // Start from 100000
});

module.exports = mongoose.model('RaidId', raidIdSchema);


// const mongoose = require('mongoose');

// const raidIdSchema = new mongoose.Schema({
//   _id: { type: String, default: 'raidId' },
//   sequence: { type: Number, default: 99999 } // Start from 99999, first increment to 100000
// });

// module.exports = mongoose.model('RaidId', raidIdSchema);