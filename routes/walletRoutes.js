const express = require("express");
const { getWallet, requestWithdraw } = require("../controllers/driver/WalletController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, getWallet);
router.post("/withdraw", authMiddleware, requestWithdraw);

module.exports = router;
