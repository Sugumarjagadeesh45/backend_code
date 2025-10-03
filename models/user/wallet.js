// Wallet.js example
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const walletSchema = new Schema({
  driver: { type: Schema.Types.ObjectId, ref: "Driver" },
  balance: { type: Number, default: 0 },
  transactions: [{ type: Schema.Types.ObjectId, ref: "Transaction" }]
});

module.exports = mongoose.model("Wallet", walletSchema);
