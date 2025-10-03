// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ msg: "No token, authorization denied" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ msg: "No token provided" });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ msg: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;








// // middleware/authMiddleware.js
// const jwt = require("jsonwebtoken");

// const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// // ✅ Middleware to verify JWT
// const authMiddleware = (req, res, next) => {
//   try {
//     const authHeader = req.headers["authorization"];
//     if (!authHeader) {
//       return res.status(401).json({ msg: "No token, authorization denied" });
//     }
//     const token = authHeader.split(" ")[1];
//     if (!token) {
//       return res.status(401).json({ msg: "No token provided" });
//     }
//     const decoded = jwt.verify(token, JWT_SECRET);
//     req.user = decoded;
//     next();
//   } catch (err) {
//     return res.status(403).json({ msg: "Invalid or expired token" });
//   }
// };



// module.exports = (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split(' ')[1];
//     if (!token) {
//       return res.status(401).json({ error: 'No token provided' });
//     }
    
//     const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
//     req.user = decoded;
//     next();
//   } catch (error) {
//     res.status(401).json({ error: 'Invalid token' });
//   }
// };


// module.exports = authMiddleware;
