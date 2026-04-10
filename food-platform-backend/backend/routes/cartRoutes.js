const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  removeCoupon,
  validateCart,
  updateDeliveryAddress,
  updateCartNotes,
  mergeGuestCart,
  getCartSummary,
  estimateDelivery,
} = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');
const {
  preventMultiRestaurantConflict,
  validateMenuItemAvailability,
  validateCartItemQuantity,
  validateCoupon,
  validateCartForCheckout,
  validateCartItemCustomizations,
  cartRateLimit,
  logCartOperation,
} = require('../middleware/cartMiddleware');

const router = express.Router();

// Validation rules
const addToCartValidation = [
  body('menuItemId')
    .isMongoId()
    .withMessage('Valid menu item ID required'),
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Quantity must be between 1 and 50'),
  body('customizations')
    .optional()
    .isArray()
    .withMessage('Customizations must be an array'),
  body('specialInstructions')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Special instructions cannot exceed 200 characters'),
];

const updateQuantityValidation = [
  param('itemId')
    .isMongoId()
    .withMessage('Valid item ID required'),
  body('quantity')
    .isInt({ min: 0, max: 50 })
    .withMessage('Quantity must be between 0 and 50'),
];

const applyCouponValidation = [
  body('couponCode')
    .notEmpty()
    .withMessage('Coupon code is required')
    .isString()
    .trim()
    .toUpperCase(),
];

const deliveryAddressValidation = [
  body('addressId')
    .isMongoId()
    .withMessage('Valid address ID required'),
];

const notesValidation = [
  body('notes')
    .isString()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
    .trim(),
];

const mergeCartValidation = [
  body('items')
    .isArray()
    .withMessage('Items must be an array'),
  body('items.*.menuItemId')
    .isMongoId()
    .withMessage('Valid menu item ID required'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 50 })
    .withMessage('Quantity must be between 1 and 50'),
];

const estimateDeliveryValidation = [
  query('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude required'),
  query('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude required'),
];

// ==================== PROTECTED ROUTES ====================
// All cart routes require authentication
router.use(protect);
router.use(cartRateLimit);
router.use(logCartOperation('CART_OPERATION'));

/**
 * @route   GET /api/cart
 * @desc    Get user's cart
 * @access  Private
 */
router.get('/', getCart);

/**
 * @route   GET /api/cart/summary
 * @desc    Get cart summary
 * @access  Private
 */
router.get('/summary', getCartSummary);

/**
 * @route   GET /api/cart/validate
 * @desc    Validate cart before checkout
 * @access  Private
 */
router.get('/validate', validateCartForCheckout, validateCart);

/**
 * @route   GET /api/cart/estimate-delivery
 * @desc    Estimate delivery time and fee
 * @access  Private
 */
router.get('/estimate-delivery', estimateDeliveryValidation, estimateDelivery);

/**
 * @route   POST /api/cart/items
 * @desc    Add item to cart
 * @access  Private
 */
router.post(
  '/items',
  addToCartValidation,
  validateMenuItemAvailability,
  validateCartItemCustomizations,
  preventMultiRestaurantConflict,
  addToCart
);

/**
 * @route   PUT /api/cart/items/:itemId
 * @desc    Update cart item quantity
 * @access  Private
 */
router.put(
  '/items/:itemId',
  updateQuantityValidation,
  validateCartItemQuantity,
  updateCartItem
);

/**
 * @route   DELETE /api/cart/items/:itemId
 * @desc    Remove item from cart
 * @access  Private
 */
router.delete(
  '/items/:itemId',
  param('itemId').isMongoId().withMessage('Valid item ID required'),
  removeFromCart
);

/**
 * @route   DELETE /api/cart
 * @desc    Clear entire cart
 * @access  Private
 */
router.delete('/', clearCart);

/**
 * @route   POST /api/cart/coupon
 * @desc    Apply coupon to cart
 * @access  Private
 */
router.post('/coupon', applyCouponValidation, validateCoupon, applyCoupon);

/**
 * @route   DELETE /api/cart/coupon
 * @desc    Remove coupon from cart
 * @access  Private
 */
router.delete('/coupon', removeCoupon);

/**
 * @route   PUT /api/cart/address
 * @desc    Update delivery address in cart
 * @access  Private
 */
router.put('/address', deliveryAddressValidation, updateDeliveryAddress);

/**
 * @route   PUT /api/cart/notes
 * @desc    Update cart notes
 * @access  Private
 */
router.put('/notes', notesValidation, updateCartNotes);

/**
 * @route   POST /api/cart/merge
 * @desc    Merge guest cart with user cart
 * @access  Private
 */
router.post('/merge', mergeCartValidation, mergeGuestCart);

module.exports = router;