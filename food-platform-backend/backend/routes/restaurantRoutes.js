const express = require('express');
const { body, query, param } = require('express-validator');
const {
  getNearbyRestaurants,
  searchRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getRestaurantMenu,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  updateRestaurantStatus,
  getRestaurantOrders,
  updateOrderStatus,
  getRestaurantAnalytics,
  getRestaurantReviews,
  addRestaurantReview,
  updateRestaurantReview,
  getRestaurantByOwner,
  toggleRestaurantAvailability,
  bulkUploadMenu,
  getPopularRestaurants,
  getRestaurantCategories,
} = require('../controllers/restaurantController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Validation rules
const restaurantValidation = [
  body('name')
    .notEmpty().withMessage('Restaurant name is required')
    .isLength({ min: 3 }).withMessage('Name must be at least 3 characters')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('description')
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
  body('cuisineTypes')
    .isArray().withMessage('Cuisine types must be an array')
    .notEmpty().withMessage('At least one cuisine type is required'),
  body('address.street').notEmpty().withMessage('Street address is required'),
  body('address.city').notEmpty().withMessage('City is required'),
  body('address.state').notEmpty().withMessage('State is required'),
  body('address.postalCode').notEmpty().withMessage('Postal code is required'),
  body('address.location.coordinates')
    .isArray().withMessage('Coordinates must be an array')
    .custom(value => value.length === 2).withMessage('Coordinates must have exactly 2 values [longitude, latitude]'),
  body('priceRange')
    .isIn(['$', '$$', '$$$', '$$$$']).withMessage('Invalid price range'),
  body('deliverySettings.minimumOrderAmount')
    .optional()
    .isNumeric().withMessage('Minimum order amount must be a number'),
  body('deliverySettings.deliveryFee')
    .optional()
    .isNumeric().withMessage('Delivery fee must be a number'),
  body('contactInfo.phone')
    .notEmpty().withMessage('Contact phone is required'),
  body('contactInfo.email')
    .isEmail().withMessage('Valid contact email is required'),
];

const menuItemValidation = [
  body('name')
    .notEmpty().withMessage('Item name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('description')
    .notEmpty().withMessage('Description is required'),
  body('category')
    .isIn(['Appetizer', 'Main Course', 'Soup', 'Salad', 'Dessert', 'Beverage', 'Bread', 'Rice', 'Noodles', 'Combo', 'Kids Meal'])
    .withMessage('Invalid category'),
  body('price')
    .isNumeric().withMessage('Price must be a number')
    .isFloat({ min: 0 }).withMessage('Price cannot be negative'),
  body('isVegetarian')
    .optional()
    .isBoolean().withMessage('isVegetarian must be boolean'),
  body('preparationTime')
    .optional()
    .isInt({ min: 5, max: 60 }).withMessage('Preparation time must be between 5 and 60 minutes'),
];

const reviewValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters'),
];

// ==================== PUBLIC ROUTES ====================

/**
 * @route   GET /api/restaurants/nearby
 * @desc    Get nearby restaurants based on geolocation
 * @access  Public
 */
router.get('/nearby', [
  query('longitude').isNumeric().withMessage('Longitude is required and must be a number'),
  query('latitude').isNumeric().withMessage('Latitude is required and must be a number'),
  query('radius').optional().isNumeric().withMessage('Radius must be a number'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
], getNearbyRestaurants);

/**
 * @route   GET /api/restaurants/search
 * @desc    Search restaurants with filters
 * @access  Public
 */
router.get('/search', [
  query('query').optional().isString().trim(),
  query('cuisine').optional().isString(),
  query('priceRange').optional().isIn(['$', '$$', '$$$', '$$$$']),
  query('minRating').optional().isFloat({ min: 0, max: 5 }),
  query('city').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], searchRestaurants);

/**
 * @route   GET /api/restaurants/popular
 * @desc    Get popular restaurants
 * @access  Public
 */
router.get('/popular', getPopularRestaurants);

/**
 * @route   GET /api/restaurants/categories
 * @desc    Get all restaurant categories/cuisines
 * @access  Public
 */
router.get('/categories', getRestaurantCategories);

/**
 * @route   GET /api/restaurants/:id
 * @desc    Get restaurant by ID with menu
 * @access  Public
 */
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid restaurant ID'),
], getRestaurantById);

/**
 * @route   GET /api/restaurants/:id/menu
 * @desc    Get restaurant menu items
 * @access  Public
 */
router.get('/:id/menu', [
  param('id').isMongoId().withMessage('Invalid restaurant ID'),
  query('category').optional().isString(),
  query('isVegetarian').optional().isBoolean(),
  query('isAvailable').optional().isBoolean(),
], getRestaurantMenu);

/**
 * @route   GET /api/restaurants/:id/reviews
 * @desc    Get restaurant reviews
 * @access  Public
 */
router.get('/:id/reviews', [
  param('id').isMongoId().withMessage('Invalid restaurant ID'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], getRestaurantReviews);

// ==================== PROTECTED ROUTES (Customer) ====================

/**
 * @route   POST /api/restaurants/:id/reviews
 * @desc    Add review for restaurant
 * @access  Private (Customer)
 */
router.post('/:id/reviews', 
  protect, 
  authorize('customer'), 
  param('id').isMongoId(),
  reviewValidation,
  addRestaurantReview
);

/**
 * @route   PUT /api/restaurants/:id/reviews/:reviewId
 * @desc    Update restaurant review
 * @access  Private (Customer - own review)
 */
router.put('/:id/reviews/:reviewId',
  protect,
  authorize('customer'),
  reviewValidation,
  updateRestaurantReview
);

// ==================== PROTECTED ROUTES (Restaurant Owner/Admin) ====================

/**
 * @route   GET /api/restaurants/owner/my-restaurant
 * @desc    Get restaurant owned by current user
 * @access  Private (Restaurant Owner)
 */
router.get('/owner/my-restaurant', 
  protect, 
  authorize('restaurant_owner', 'admin'), 
  getRestaurantByOwner
);

/**
 * @route   POST /api/restaurants
 * @desc    Create new restaurant
 * @access  Private (Restaurant Owner/Admin)
 */
router.post('/',
  protect,
  authorize('restaurant_owner', 'admin'),
  restaurantValidation,
  createRestaurant
);

/**
 * @route   PUT /api/restaurants/:id
 * @desc    Update restaurant
 * @access  Private (Owner/Admin)
 */
router.put('/:id',
  protect,
  authorize('restaurant_owner', 'admin'),
  param('id').isMongoId(),
  restaurantValidation,
  updateRestaurant
);

/**
 * @route   DELETE /api/restaurants/:id
 * @desc    Delete restaurant (soft delete)
 * @access  Private (Owner/Admin)
 */
router.delete('/:id',
  protect,
  authorize('restaurant_owner', 'admin'),
  param('id').isMongoId(),
  deleteRestaurant
);

/**
 * @route   PATCH /api/restaurants/:id/status
 * @desc    Update restaurant open/closed status
 * @access  Private (Owner/Admin)
 */
router.patch('/:id/status',
  protect,
  authorize('restaurant_owner', 'admin'),
  param('id').isMongoId(),
  body('isOpen').isBoolean().withMessage('isOpen must be boolean'),
  updateRestaurantStatus
);

/**
 * @route   PATCH /api/restaurants/:id/availability
 * @desc    Toggle restaurant delivery/dine-in availability
 * @access  Private (Owner/Admin)
 */
router.patch('/:id/availability',
  protect,
  authorize('restaurant_owner', 'admin'),
  param('id').isMongoId(),
  toggleRestaurantAvailability
);

/**
 * @route   POST /api/restaurants/:id/menu
 * @desc    Add menu item to restaurant
 * @access  Private (Owner/Admin)
 */
router.post('/:id/menu',
  protect,
  authorize('restaurant_owner', 'admin'),
  param('id').isMongoId(),
  menuItemValidation,
  addMenuItem
);

/**
 * @route   POST /api/restaurants/:id/menu/bulk
 * @desc    Bulk upload menu items
 * @access  Private (Owner/Admin)
 */
router.post('/:id/menu/bulk',
  protect,
  authorize('restaurant_owner', 'admin'),
  param('id').isMongoId(),
  body('items').isArray().withMessage('Items must be an array'),
  bulkUploadMenu
);

/**
 * @route   PUT /api/restaurants/:id/menu/:itemId
 * @desc    Update menu item
 * @access  Private (Owner/Admin)
 */
router.put('/:id/menu/:itemId',
  protect,
  authorize('restaurant_owner', 'admin'),
  menuItemValidation,
  updateMenuItem
);

/**
 * @route   DELETE /api/restaurants/:id/menu/:itemId
 * @desc    Delete menu item
 * @access  Private (Owner/Admin)
 */
router.delete('/:id/menu/:itemId',
  protect,
  authorize('restaurant_owner', 'admin'),
  deleteMenuItem
);

/**
 * @route   GET /api/restaurants/:id/orders
 * @desc    Get restaurant orders
 * @access  Private (Owner/Admin)
 */
router.get('/:id/orders',
  protect,
  authorize('restaurant_owner', 'admin'),
  param('id').isMongoId(),
  query('status').optional().isString(),
  query('date').optional().isDate(),
  query('page').optional().isInt({ min: 1 }),
  getRestaurantOrders
);

/**
 * @route   PATCH /api/restaurants/:id/orders/:orderId/status
 * @desc    Update order status
 * @access  Private (Owner/Admin)
 */
router.patch('/:id/orders/:orderId/status',
  protect,
  authorize('restaurant_owner', 'admin', 'delivery_partner'),
  param('id').isMongoId(),
  param('orderId').isMongoId(),
  body('status').isIn(['confirmed', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'cancelled'])
    .withMessage('Invalid status'),
  updateOrderStatus
);

/**
 * @route   GET /api/restaurants/:id/analytics
 * @desc    Get restaurant analytics
 * @access  Private (Owner/Admin)
 */
router.get('/:id/analytics',
  protect,
  authorize('restaurant_owner', 'admin'),
  param('id').isMongoId(),
  query('period').optional().isIn(['day', 'week', 'month', 'year']),
  getRestaurantAnalytics
);

module.exports = router;