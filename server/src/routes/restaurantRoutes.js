const express = require('express');
const router = express.Router();
console.log("Restaurant routes loaded");
const {
  createRestaurant,
  getRestaurants,
} = require('../controllers/restaurantController');

const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createRestaurant);
router.get('/', getRestaurants);
console.log("Restaurant routes loaded");
module.exports = router;