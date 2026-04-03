const Restaurant = require('../models/Restaurant');

// Create restaurant
exports.createRestaurant = async (req, res) => {
  try {
    const { name, cuisine, location } = req.body;

    const restaurant = await Restaurant.create({
      name,
      cuisine,
      location,
      owner: req.user._id,
    });

    res.status(201).json(restaurant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all restaurants (with basic filters)
exports.getRestaurants = async (req, res) => {
  try {
    const { cuisine, rating } = req.query;

    let filter = {};

    if (cuisine) filter.cuisine = cuisine;
    if (rating) filter.rating = { $gte: Number(rating) };

    const restaurants = await Restaurant.find(filter);

    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};