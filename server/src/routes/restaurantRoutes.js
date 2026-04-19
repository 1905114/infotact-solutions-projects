const express = require('express');
const router = express.Router();
const { adminOnly } = require('../middleware/restaurantMiddleware');
console.log("Restaurant routes loaded");
const {
  createRestaurant,
  getRestaurants,
} = require('../controllers/restaurantController');

const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createRestaurant);
router.get('/', getRestaurants);
router.post('/', protect, adminOnly, createRestaurant);
console.log("Restaurant routes loaded");
module.exports = router;