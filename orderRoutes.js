const express = require('express');
const { body, param, query } = require('express-validator');
const {
  createOrder,
  getOrderById,
  getMyOrders,
  getRestaurantOrders,
  updateOrderStatus,
  assignDeliveryPartner,
  updateDeliveryLocation,
  cancelOrder,
  trackOrder,
  rateOrder,
  getOrderAnalytics,
  getOrderInvoice,
  reorder,
  getOrderTimeline,
  getNearbyDeliveryPartners,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateCartForCheckout } = require('../middleware/cartMiddleware');

const router = express.Router();

// Validation rules
const createOrderValidation = [
  body('deliveryAddressId')
    .optional()
    .isMongoId()
    .withMessage('Valid delivery address ID required'),
  body('specialInstructions')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Special instructions cannot exceed 500 characters'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'upi', 'online', 'wallet'])
    .withMessage('Invalid payment method'),
];

const updateStatusValidation = [
  param('id')
    .isMongoId()
    .withMessage('Valid order ID required'),
  body('status')
    .isIn(['confirmed', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('note')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),
];

const assignDeliveryValidation = [
  param('id')
    .isMongoId()
    .withMessage('Valid order ID required'),
  body('deliveryPartnerId')
    .isMongoId()
    .withMessage('Valid delivery partner ID required'),
];

const locationUpdateValidation = [
  param('id')
    .isMongoId()
    .withMessage('Valid order ID required'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude required'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude required'),
];

const cancelOrderValidation = [
  param('id')
    .isMongoId()
    .withMessage('Valid order ID required'),
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
];

const rateOrderValidation = [
  param('id')
    .isMongoId()
    .withMessage('Valid order ID required'),
  body('foodRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Food rating must be between 1 and 5'),
  body('deliveryRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Delivery rating must be between 1 and 5'),
  body('review')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Review cannot exceed 500 characters'),
];

const getOrdersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  query('orderType')
    .optional()
    .isIn(['delivery', 'dine-in', 'takeaway'])
    .withMessage('Invalid order type'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date'),
];

const getRestaurantOrdersValidation = [
  param('restaurantId')
    .isMongoId()
    .withMessage('Valid restaurant ID required'),
  query('page')
    .optional()
    .isInt({ min: 1 }),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }),
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'completed', 'cancelled']),
];

const reorderValidation = [
  param('id')
    .isMongoId()
    .withMessage('Valid order ID required'),
];

// ==================== PROTECTED ROUTES ====================
// All order routes require authentication
router.use(protect);

/**
 * @route   POST /api/orders
 * @desc    Create new order from cart
 * @access  Private
 */
router.post(
  '/',
  createOrderValidation,
  validateCartForCheckout,
  createOrder
);

/**
 * @route   GET /api/orders/my-orders
 * @desc    Get user's orders
 * @access  Private
 */
router.get('/my-orders', getOrdersValidation, getMyOrders);

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private
 */
router.get(
  '/:id',
  param('id').isMongoId().withMessage('Valid order ID required'),
  getOrderById
);

/**
 * @route   GET /api/orders/:id/track
 * @desc    Track order in real-time
 * @access  Private
 */
router.get(
  '/:id/track',
  param('id').isMongoId().withMessage('Valid order ID required'),
  trackOrder
);

/**
 * @route   GET /api/orders/:id/timeline
 * @desc    Get order status timeline
 * @access  Private
 */
router.get(
  '/:id/timeline',
  param('id').isMongoId().withMessage('Valid order ID required'),
  getOrderTimeline
);

/**
 * @route   GET /api/orders/:id/invoice
 * @desc    Get order invoice
 * @access  Private
 */
router.get(
  '/:id/invoice',
  param('id').isMongoId().withMessage('Valid order ID required'),
  getOrderInvoice
);

/**
 * @route   POST /api/orders/:id/cancel
 * @desc    Cancel order
 * @access  Private
 */
router.post(
  '/:id/cancel',
  cancelOrderValidation,
  cancelOrder
);

/**
 * @route   POST /api/orders/:id/rate
 * @desc    Rate order after delivery
 * @access  Private
 */
router.post(
  '/:id/rate',
  rateOrderValidation,
  rateOrder
);

/**
 * @route   POST /api/orders/:id/reorder
 * @desc    Reorder previous order
 * @access  Private
 */
router.post(
  '/:id/reorder',
  reorderValidation,
  reorder
);

// ==================== RESTAURANT OWNER ROUTES ====================

/**
 * @route   GET /api/orders/restaurant/:restaurantId
 * @desc    Get orders for a restaurant (owner only)
 * @access  Private (Restaurant Owner/Admin)
 */
router.get(
  '/restaurant/:restaurantId',
  authorize('restaurant_owner', 'admin'),
  getRestaurantOrdersValidation,
  getRestaurantOrders
);

/**
 * @route   PATCH /api/orders/:id/status
 * @desc    Update order status
 * @access  Private (Restaurant Owner/Admin/Delivery Partner)
 */
router.patch(
  '/:id/status',
  authorize('restaurant_owner', 'admin', 'delivery_partner'),
  updateStatusValidation,
  updateOrderStatus
);

/**
 * @route   POST /api/orders/:id/assign-delivery
 * @desc    Assign delivery partner to order
 * @access  Private (Restaurant Owner/Admin)
 */
router.post(
  '/:id/assign-delivery',
  authorize('restaurant_owner', 'admin'),
  assignDeliveryValidation,
  assignDeliveryPartner
);

/**
 * @route   GET /api/orders/nearby-delivery-partners
 * @desc    Get nearby delivery partners for order
 * @access  Private (Restaurant Owner/Admin)
 */
router.get(
  '/nearby-delivery-partners/:orderId',
  authorize('restaurant_owner', 'admin'),
  param('orderId').isMongoId().withMessage('Valid order ID required'),
  getNearbyDeliveryPartners
);

// ==================== DELIVERY PARTNER ROUTES ====================

/**
 * @route   POST /api/orders/:id/location
 * @desc    Update delivery partner location
 * @access  Private (Delivery Partner)
 */
router.post(
  '/:id/location',
  authorize('delivery_partner'),
  locationUpdateValidation,
  updateDeliveryLocation
);

// ==================== ADMIN ONLY ROUTES ====================

/**
 * @route   GET /api/orders/analytics
 * @desc    Get order analytics
 * @access  Private/Admin
 */
router.get(
  '/analytics',
  authorize('admin'),
  query('period').optional().isIn(['day', 'week', 'month', 'year']),
  getOrderAnalytics
);

module.exports = router;