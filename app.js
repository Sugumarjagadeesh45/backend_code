const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const app = express();

// Enable CORS for all origins
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],

    path: "/socket.io/", // ✅ Idhu same-a irukkanum
  transports: ['polling', 'websocket'] ,// ✅ Idhum add pannu

  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Created uploads directory");
}


// Serve static files from uploads directory
app.use("/uploads", express.static(uploadsDir));

// ✅ Driver Location Routes
// Only declare each route once
const driverLocationHistoryRoutes = require("./routes/driverLocationHistoryRoutes");
// If you also have driverLocationRoutes.js, uncomment the next line and make sure the file exists
// const driverLocationRoutes = require("./routes/driverLocationRoutes");

app.use("/api", driverLocationHistoryRoutes);
// app.use("/api", driverLocationRoutes); // Uncomment only if driverLocationRoutes.js exists

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ✅ Import other routes
const adminRoutes = require("./routes/adminRoutes");
const driverRoutes = require("./routes/driverRoutes");
const rideRoutes = require("./routes/rideRoutes");
const groceryRoutes = require("./routes/groceryRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const walletRoutes = require("./routes/walletRoutes");
const routeRoutes = require("./routes/routeRoutes");


// ✅ Mount other routes
app.use("/api/admins", adminRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/groceries", groceryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallet", walletRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Taxi app API is running...");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(500).send("Something broke!");
});

module.exports = app;



// const express = require("express");
// const cors = require("cors");
// const multer = require("multer");
// const path = require("path");

// const app = express();

// // Enable CORS
// app.use(
//   cors({
//     origin: [
//       "http://localhost:3000",
//       "http://192.168.1.107:3000",
//       "http://10.0.2.2:5001", // Android Emulator
//       "https://raidbackend.onrender.com",
//     ],
//     methods: ["GET", "POST", "PUT", "DELETE"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

// app.use(express.json());
// app.use("/uploads", express.static("uploads"));

// // Multer setup
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, "uploads/"),
//   filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
// });
// const upload = multer({ storage });

// // ✅ Import routes
// const adminRoutes = require("./routes/adminRoutes");
// const driverRoutes = require("./routes/driverRoutes");
// const rideRoutes = require("./routes/rideRoutes");
// const groceryRoutes = require("./routes/groceryRoutes");
// const authRoutes = require("./routes/authRoutes");
// const userRoutes = require("./routes/userRoutes");
// const walletRoutes = require("./routes/walletRoutes");
// const routeRoutes = require("./routes/routeRoutes"); // ✅ fixed duplicate

// // ✅ Mount routes
// app.use("/api/admins", adminRoutes);
// app.use("/api/drivers", driverRoutes);
// app.use("/api/rides", rideRoutes);
// app.use("/api/groceries", groceryRoutes);
// app.use("/api/auth", authRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/wallet", walletRoutes);
// app.use("/api/routes", routeRoutes); // ✅ OSRM routes

// // Test route
// app.get("/", (req, res) => {
//   res.send("Taxi app API is running...");
// });

// module.exports = app;