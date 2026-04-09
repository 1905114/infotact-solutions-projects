const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const { asyncHandler } = require('../middleware/errorMiddleware');

/**
 * @desc    Get nearby restaurants based on geolocation
 * @route   GET /api/restaurants/nearby
 * @access  Public
 */
const getNearbyRestaurants = asyncHandler(async (req, res) => {
  const { longitude, latitude, radius = 5, limit = 20 } = req.query;
  
  if (!longitude || !latitude) {
    return res.status(400).json({
      success: false,
      message: 'Please provide longitude and latitude',
    });
  }
  
  const maxDistance = radius * 1000; // Convert km to meters
  
  const restaurants = await Restaurant.findNearby(
    parseFloat(longitude),
    parseFloat(latitude),
    maxDistance
  ).limit(parseInt(limit));
  
  res.status(200).json({
    success: true,
    count: restaurants.length,
    data: restaurants,
  });
});

/**
 * @desc    Search restaurants by text and filters
 * @route   GET /api/restaurants/search
 * @access  Public
 */
const searchRestaurants = asyncHandler(async (req, res) => {
  const { query, cuisine, priceRange, minRating, city, limit = 20 } = req.query;
  
  let searchQuery = { isActive: true };
  
  // Text search
  if (query) {
    searchQuery.$text = { $search: query };
  }
  
  // Filter by cuisine
  if (cuisine) {
    searchQuery.cuisineTypes = cuisine;
  }
  
  // Filter by price range
  if (priceRange) {
    searchQuery.priceRange = priceRange;
  }
  
  // Filter by minimum rating
  if (minRating) {
    searchQuery.averageRating = { $gte: parseFloat(minRating) };
  }
  
  // Filter by city
  if (city) {
    searchQuery['address.city'] = { $regex: city, $options: 'i' };
  }
  
  const restaurants = await Restaurant.find(searchQuery)
    .limit(parseInt(limit))
    .sort({ averageRating: -1, totalReviews: -1 });
  
  res.status(200).json({
    success: true,
    count: restaurants.length,
    data: restaurants,
  });
});

/**
 * @desc    Get restaurant by ID with menu items
 * @route   GET /api/restaurants/:id
 * @access  Public
 */
const getRestaurantById = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id)
    .populate('ownerId', 'firstName lastName email');
  
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }
  
  // Get menu items
  const menuItems = await MenuItem.find({
    restaurantId: restaurant._id,
    isAvailable: true,
  }).sort({ category: 1, isPopular: -1 });
  
  res.status(200).json({
    success: true,
    data: {
      restaurant,
      menuItems,
    },
  });
});

/**
 * @desc    Create new restaurant (restaurant owner only)
 * @route   POST /api/restaurants
 * @access  Private (Restaurant Owner/Admin)
 */
const createRestaurant = asyncHandler(async (req, res) => {
  req.body.ownerId = req.user.id;
  
  const restaurant = await Restaurant.create(req.body);
  
  res.status(201).json({
    success: true,
    data: restaurant,
  });
});

/**
 * @desc    Update restaurant
 * @route   PUT /api/restaurants/:id
 * @access  Private (Owner only)
 */
const updateRestaurant = asyncHandler(async (req, res) => {
  let restaurant = await Restaurant.findById(req.params.id);
  
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }
  
  // Check ownership
  if (restaurant.ownerId.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this restaurant',
    });
  }
  
  restaurant = await Restaurant.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    success: true,
    data: restaurant,
  });
});

module.exports = {
  getNearbyRestaurants,
  searchRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
};