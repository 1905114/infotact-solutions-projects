const express = require('express');
const { body, param } = require('express-validator');
const {
  getDashboardOverview,
  toggleRestaurantStatus,
  toggleMenuItemAvailability,
  bulkUpdateMenuItems,
  getRevenueAggregates,
  getPendingOrders,
  acceptOrder,
  rejectOrder,
  updateOrderPreparation,
  getMerchantMenu,
  getMerchantAnalytics,
} = require('../controllers/merchantController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// All merchant routes require restaurant owner role
router.use(protect);
router.use(authorize('restaurant_owner', 'admin'));

/**
 * @route   GET /api/merchant/dashboard
 * @desc    Get merchant dashboard overview
 * @access  Private (Restaurant Owner)
 */
router.get('/dashboard', getDashboardOverview);

/**
 * @route   GET /api/merchant/menu
 * @desc    Get merchant menu items
 * @access  Private (Restaurant Owner)
 */
router.get('/menu', getMerchantMenu);

/**
 * @route   GET /api/merchant/revenue
 * @desc    Get revenue aggregates
 * @access  Private (Restaurant Owner)
 */
router.get('/revenue', getRevenueAggregates);

/**
 * @route   GET /api/merchant/analytics
 * @desc    Get merchant analytics
 * @access  Private (Restaurant Owner)
 */
router.get('/analytics', getMerchantAnalytics);

/**
 * @route   GET /api/merchant/orders/pending
 * @desc    Get pending orders
 * @access  Private (Restaurant Owner)
 */
router.get('/orders/pending', getPendingOrders);

/**
 * @route   PATCH /api/merchant/status
 * @desc    Toggle restaurant open/closed
 * @access  Private (Restaurant Owner)
 */
router.patch('/status', [
  body('isOpen').isBoolean().withMessage('isOpen must be boolean'),
], toggleRestaurantStatus);

/**
 * @route   PATCH /api/merchant/menu/:itemId
 * @desc    Toggle menu item availability
 * @access  Private (Restaurant Owner)
 */
router.patch('/menu/:itemId', [
  param('itemId').isMongoId(),
  body('isAvailable').isBoolean(),
], toggleMenuItemAvailability);

/**
 * @route   POST /api/merchant/menu/bulk-update
 * @desc    Bulk update menu items
 * @access  Private (Restaurant Owner)
 */
router.post('/menu/bulk-update', [
  body('items').isArray(),
], bulkUpdateMenuItems);

/**
 * @route   POST /api/merchant/orders/:orderId/accept
 * @desc    Accept order
 * @access  Private (Restaurant Owner)
 */
router.post('/orders/:orderId/accept', [
  param('orderId').isMongoId(),
  body('estimatedPreparationTime').optional().isInt({ min: 5, max: 120 }),
], acceptOrder);

/**
 * @route   POST /api/merchant/orders/:orderId/reject
 * @desc    Reject order
 * @access  Private (Restaurant Owner)
 */
router.post('/orders/:orderId/reject', [
  param('orderId').isMongoId(),
  body('reason').optional().isString(),
], rejectOrder);

/**
 * @route   PATCH /api/merchant/orders/:orderId/prepare
 * @desc    Update order preparation status
 * @access  Private (Restaurant Owner)
 */
router.patch('/orders/:orderId/prepare', [
  param('orderId').isMongoId(),
  body('status').isIn(['preparing', 'ready']),
], updateOrderPreparation);

module.exports = router;