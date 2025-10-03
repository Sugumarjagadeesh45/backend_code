const express = require("express");
const axios = require("axios");
const router = express.Router();

const getOSRMUrl = () => {

  let url = process.env.OSRM_URL || "https://router.project-osrm.org";


  if (process.env.NODE_ENV === "development") {
    const isAndroidEmulator = process.env.PLATFORM === "android"; // set manually if needed
    if (isAndroidEmulator) {
      url = "http://10.0.2.2:5001"; // Android emulator maps host 5001
    } else {
      url = "http://localhost:5000"; // iOS simulator or local Node.js
    }
  }
  return url;
};



// 🚖 GET route from OSRM
router.get("/route", async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.query;

    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ error: "Missing coordinates" });
    }

    const OSRM_URL = getOSRMUrl();
    const url = `${OSRM_URL}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

    console.log("🔗 OSRM request URL:", url);

    const headers = {};
    // headers['Authorization'] = `Bearer ${process.env.OSRM_API_KEY}`; // optional for hosted OSRM

    const response = await axios.get(url, { headers });

    if (response.data.code !== "Ok") {
      console.error("🚨 OSRM returned error:", response.data);
      return res.status(500).json({ error: "OSRM route not found", details: response.data });
    }

    res.json(response.data.routes[0]); // return only the first route
  } catch (err) {
    if (err.response) {
      console.error("🚨 OSRM backend error:", err.response.status, err.response.data);
      return res.status(err.response.status).json({ error: err.response.data });
    }
    console.error("🚨 OSRM request failed:", err.message);
    res.status(500).json({ error: "OSRM service unavailable" });
  }
});

module.exports = router;
