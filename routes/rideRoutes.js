
const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const auth = require('../middleware/authMiddleware');

// Debug: Log what we're importing
console.log('Ride Controller:', rideController);
console.log('Available methods:', Object.keys(rideController));

// Apply auth middleware if needed
router.use(auth);

router.get('/', rideController.getRides);
    
// Debug: Check if getRideById exists before using it
console.log('getRideById type:', typeof rideController.getRideById);
if (typeof rideController.getRideById !== 'function') {
    console.error('ERROR: getRideById is not a function!');
}

router.get('/:rideId', rideController.getRideById);
router.post('/', rideController.createRide);
router.put('/:rideId', rideController.updateRide);
router.delete('/:rideId', rideController.deleteRide);

module.exports = router;