const express = require('express');
const { body, param, query } = require('express-validator');
const {
  initiatePayment,
  getTransactionStatus,
  getTransactionHistory,
  requestRefund,
  paymentWebhook,
  getPaymentMethods,
  verifyPayment,
  getPaymentAnalytics,
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Validation rules
const initiatePaymentValidation = [
  body('orderId')
    .isMongoId()
    .withMessage('Valid order ID required'),
  body('paymentMethod')
    .isIn(['mock', 'card', 'upi', 'netbanking', 'wallet'])
    .withMessage('Invalid payment method'),
  body('gateway')
    .optional()
    .isIn(['mock', 'stripe', 'razorpay', 'instamojo'])
    .withMessage('Invalid payment gateway'),
  body('paymentDetails')
    .optional()
    .isObject()
    .withMessage('Payment details must be an object'),
  body('paymentDetails.cardNumber')
    .optional()
    .isString()
    .matches(/^\d{16}$/)
    .withMessage('Invalid card number'),
  body('paymentDetails.expiryMonth')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Invalid expiry month'),
  body('paymentDetails.expiryYear')
    .optional()
    .isInt({ min: 2024, max: 2030 })
    .withMessage('Invalid expiry year'),
  body('paymentDetails.cvv')
    .optional()
    .isString()
    .matches(/^\d{3,4}$/)
    .withMessage('Invalid CVV'),
  body('paymentDetails.upiId')
    .optional()
    .isString()
    .matches(/^[\w.-]+@[\w.-]+$/)
    .withMessage('Invalid UPI ID'),
];

const refundValidation = [
  param('transactionId')
    .notEmpty()
    .withMessage('Transaction ID required'),
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
];

const webhookValidation = [
  param('gateway')
    .isIn(['stripe', 'razorpay', 'mock'])
    .withMessage('Invalid gateway'),
];

const transactionHistoryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'success', 'failed', 'refunded'])
    .withMessage('Invalid status'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date'),
];

const verifyPaymentValidation = [
  body('transactionId')
    .notEmpty()
    .withMessage('Transaction ID required'),
  body('paymentId')
    .optional()
    .notEmpty()
    .withMessage('Payment ID required for gateway verification'),
];

// ==================== PUBLIC ROUTES ====================

/**
 * @route   POST /api/payments/webhook/:gateway
 * @desc    Payment gateway webhook endpoint
 * @access  Public (called by payment gateway)
 */
router.post('/webhook/:gateway', webhookValidation, paymentWebhook);

/**
 * @route   GET /api/payments/methods
 * @desc    Get available payment methods
 * @access  Public
 */
router.get('/methods', getPaymentMethods);

// ==================== PROTECTED ROUTES ====================
router.use(protect);

/**
 * @route   POST /api/payments/initiate
 * @desc    Initiate payment for an order
 * @access  Private
 */
router.post('/initiate', initiatePaymentValidation, initiatePayment);

/**
 * @route   GET /api/payments/status/:transactionId
 * @desc    Get transaction status
 * @access  Private
 */
router.get('/status/:transactionId', getTransactionStatus);

/**
 * @route   GET /api/payments/history
 * @desc    Get user's transaction history
 * @access  Private
 */
router.get('/history', transactionHistoryValidation, getTransactionHistory);

/**
 * @route   POST /api/payments/verify
 * @desc    Verify payment status
 * @access  Private
 */
router.post('/verify', verifyPaymentValidation, verifyPayment);

// ==================== ADMIN ONLY ROUTES ====================

/**
 * @route   POST /api/payments/refund/:transactionId
 * @desc    Request refund for transaction
 * @access  Private/Admin
 */
router.post('/refund/:transactionId', authorize('admin'), refundValidation, requestRefund);

/**
 * @route   GET /api/payments/analytics
 * @desc    Get payment analytics
 * @access  Private/Admin
 */
router.get('/analytics', authorize('admin'), getPaymentAnalytics);

module.exports = router;