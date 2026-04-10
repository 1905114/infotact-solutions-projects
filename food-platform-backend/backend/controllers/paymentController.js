const paymentService = require('../services/paymentService');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const { asyncHandler } = require('../middleware/errorMiddleware');

/**
 * @desc    Initialize payment for an order
 * @route   POST /api/payments/initiate
 * @access  Private
 */
const initiatePayment = asyncHandler(async (req, res) => {
  const { orderId, paymentMethod, gateway = 'mock', paymentDetails = {} } = req.body;

  // Verify order exists and belongs to user
  const order = await Order.findOne({
    _id: orderId,
    userId: req.user.id,
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  if (order.paymentStatus === 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Order already paid',
    });
  }

  // Process payment
  const result = await paymentService.processPayment({
    orderId,
    userId: req.user.id,
    amount: order.totalAmount,
    paymentMethod,
    gateway,
    paymentDetails: {
      ...paymentDetails,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  if (result.success) {
    // Update order payment status
    order.paymentStatus = 'completed';
    await order.save();

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        transactionId: result.transaction.transactionId,
        orderId: order._id,
        amount: order.totalAmount,
        status: result.transaction.status,
      },
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message,
      data: {
        transactionId: result.transaction.transactionId,
        status: result.transaction.status,
      },
    });
  }
});

/**
 * @desc    Get transaction status
 * @route   GET /api/payments/status/:transactionId
 * @access  Private
 */
const getTransactionStatus = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  const transaction = await paymentService.getTransactionStatus(transactionId);

  // Check authorization
  if (transaction.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this transaction',
    });
  }

  res.status(200).json({
    success: true,
    data: {
      transactionId: transaction.transactionId,
      orderId: transaction.orderId,
      amount: transaction.amount,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      createdAt: transaction.createdAt,
      gatewayResponse: transaction.gatewayResponse,
    },
  });
});

/**
 * @desc    Get user's transaction history
 * @route   GET /api/payments/history
 * @access  Private
 */
const getTransactionHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const filter = { userId: req.user.id };
  if (status) filter.status = status;

  const transactions = await Transaction.find(filter)
    .populate('orderId', 'orderNumber totalAmount')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Transaction.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: transactions.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: transactions,
  });
});

/**
 * @desc    Request refund for transaction (admin only)
 * @route   POST /api/payments/refund/:transactionId
 * @access  Private/Admin
 */
const requestRefund = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const { amount, reason } = req.body;

  const result = await paymentService.refundPayment(transactionId, amount, reason);

  res.status(200).json({
    success: result.success,
    message: result.message,
    data: result,
  });
});

/**
 * @desc    Payment webhook endpoint
 * @route   POST /api/payments/webhook/:gateway
 * @access  Public (called by payment gateway)
 */
const paymentWebhook = asyncHandler(async (req, res) => {
  const { gateway } = req.params;
  const signature = req.headers['stripe-signature'] || req.headers['x-webhook-signature'];

  const result = await paymentService.handleWebhook(
    JSON.stringify(req.body),
    signature,
    gateway
  );

  res.status(200).json({
    success: true,
    received: true,
  });
});

module.exports = {
  initiatePayment,
  getTransactionStatus,
  getTransactionHistory,
  requestRefund,
  paymentWebhook,
};