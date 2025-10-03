const Wallet = require("../../models/user/wallet");
const Transaction = require("../../models/driver/transaction");

const getWallet = async (req, res) => {
  try {
    const driverId = req.user.id;
    let wallet = await Wallet.findOne({ driver: driverId }).populate("transactions");

    if (!wallet) {
      wallet = new Wallet({ driver: driverId, balance: 0 });
      await wallet.save();
    }

    res.json({ balance: wallet.balance, transactions: wallet.transactions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const requestWithdraw = async (req, res) => { 
  try {
    const driverId = req.user.id;
    const { amount, method } = req.body;

    const wallet = await Wallet.findOne({ driver: driverId });
    if (!wallet) return res.status(404).json({ message: "Wallet not found" });
    if (wallet.balance < amount) return res.status(400).json({ message: "Insufficient balance" });

    wallet.balance -= amount;
    await wallet.save();

    const tx = new Transaction({ driver: driverId, amount, type: "debit", method });
    await tx.save();

    wallet.transactions.push(tx._id);
    await wallet.save();

    res.json({ success: true, message: "Withdrawal requested", transaction: tx });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getWallet, requestWithdraw };
