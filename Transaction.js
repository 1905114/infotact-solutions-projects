const mongoose = require('mongoose');

/**
 * Transaction Schema - Tracks all payment transactions
 */
const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      enum: ['INR', 'USD', 'EUR', 'GBP'],
    },
    paymentMethod: {
      type: String,
      enum: ['mock', 'card', 'upi', 'netbanking', 'wallet', 'cod'],
      required: true,
    },
    paymentGateway: {
      type: String,
      enum: ['mock', 'stripe', 'razorpay', 'instamojo', 'paypal'],
      default: 'mock',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'success', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
      index: true,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    paymentDetails: {
      cardLast4: {
        type: String,
        match: /^\d{4}$/,
      },
      cardBrand: {
        type: String,
        enum: ['Visa', 'MasterCard', 'Amex', 'RuPay', null],
      },
      upiId: {
        type: String,
        lowercase: true,
      },
      bankReference: {
        type: String,
      },
      bankName: {
        type: String,
      },
      walletId: {
        type: String,
      },
      paidAt: {
        type: Date,
      },
    },
    metadata: {
      ipAddress: {
        type: String,
      },
      userAgent: {
        type: String,
      },
      couponApplied: {
        type: String,
      },
      discountAmount: {
        type: Number,
        default: 0,
      },
      notes: {
        type: String,
      },
    },
    failureReason: {
      type: String,
      default: null,
    },
    failureCode: {
      type: String,
      default: null,
    },
    refundDetails: {
      refundId: {
        type: String,
      },
      refundAmount: {
        type: Number,
        min: 0,
      },
      refundReason: {
        type: String,
      },
      refundedAt: {
        type: Date,
      },
      processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    webhookReceived: {
      type: Boolean,
      default: false,
    },
    webhookProcessedAt: {
      type: Date,
    },
    webhookData: {
      type: mongoose.Schema.Types.Mixed,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastRetryAt: {
      type: Date,
    },
    receiptUrl: {
      type: String,
      default: null,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for efficient queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ orderId: 1, status: 1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ paymentMethod: 1, paymentGateway: 1 });
transactionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // Auto-delete after 90 days

/**
 * Virtual for formatted amount
 */
transactionSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: this.currency,
  }).format(this.amount);
});

/**
 * Virtual for isRefundable
 */
transactionSchema.virtual('isRefundable').get(function() {
  return this.status === 'success' && 
         !this.refundDetails.refundId && 
         this.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Within 30 days
});

/**
 * Generate unique transaction ID
 */
transactionSchema.statics.generateTransactionId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TXN_${timestamp}_${random}_${sequence}`;
};

/**
 * Generate invoice number
 */
transactionSchema.statics.generateInvoiceNumber = function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${year}${month}${day}-${random}`;
};

/**
 * Update transaction status
 */
transactionSchema.methods.updateStatus = function(status, gatewayResponse = {}) {
  const oldStatus = this.status;
  this.status = status;
  this.gatewayResponse = { ...this.gatewayResponse, ...gatewayResponse };
  
  if (status === 'success') {
    this.paymentDetails.paidAt = new Date();
    if (!this.invoiceNumber) {
      this.invoiceNumber = this.constructor.generateInvoiceNumber();
    }
  }
  
  if (status === 'failed' && oldStatus !== 'failed') {
    this.retryCount += 1;
    this.lastRetryAt = new Date();
  }
  
  return this.save();
};

/**
 * Mark as successful payment
 */
transactionSchema.methods.markSuccess = function(gatewayResponse = {}) {
  this.status = 'success';
  this.paymentDetails.paidAt = new Date();
  this.gatewayResponse = { ...this.gatewayResponse, ...gatewayResponse };
  
  if (!this.invoiceNumber) {
    this.invoiceNumber = this.constructor.generateInvoiceNumber();
  }
  
  return this.save();
};

/**
 * Mark as failed payment
 */
transactionSchema.methods.markFailed = function(reason, errorCode = null, gatewayResponse = {}) {
  this.status = 'failed';
  this.failureReason = reason;
  this.failureCode = errorCode;
  this.gatewayResponse = { ...this.gatewayResponse, ...gatewayResponse };
  this.retryCount += 1;
  this.lastRetryAt = new Date();
  
  return this.save();
};

/**
 * Process refund
 */
transactionSchema.methods.processRefund = async function(amount, reason, processedBy) {
  if (this.status !== 'success') {
    throw new Error('Cannot refund a transaction that is not successful');
  }
  
  if (this.refundDetails.refundId) {
    throw new Error('Transaction already refunded');
  }
  
  const refundAmount = amount || this.amount;
  
  if (refundAmount > this.amount) {
    throw new Error('Refund amount cannot exceed transaction amount');
  }
  
  const refundId = `REF_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  this.refundDetails = {
    refundId,
    refundAmount,
    refundReason: reason,
    refundedAt: new Date(),
    processedBy,
  };
  
  this.status = refundAmount === this.amount ? 'refunded' : 'partially_refunded';
  
  await this.save();
  
  return {
    refundId,
    refundAmount,
    status: this.status,
  };
};

/**
 * Retry failed payment
 */
transactionSchema.methods.retryPayment = async function() {
  if (this.status !== 'failed') {
    throw new Error('Only failed transactions can be retried');
  }
  
  if (this.retryCount >= 3) {
    throw new Error('Maximum retry limit reached');
  }
  
  this.status = 'processing';
  this.failureReason = null;
  this.failureCode = null;
  
  await this.save();
  
  return this;
};

/**
 * Get transaction summary
 */
transactionSchema.methods.getSummary = function() {
  return {
    transactionId: this.transactionId,
    orderId: this.orderId,
    amount: this.amount,
    formattedAmount: this.formattedAmount,
    currency: this.currency,
    paymentMethod: this.paymentMethod,
    paymentGateway: this.paymentGateway,
    status: this.status,
    createdAt: this.createdAt,
    paidAt: this.paymentDetails?.paidAt,
    isRefundable: this.isRefundable,
    refundDetails: this.refundDetails,
    receiptUrl: this.receiptUrl,
    invoiceNumber: this.invoiceNumber,
  };
};

/**
 * Static method to get user's transaction summary
 */
transactionSchema.statics.getUserTransactionSummary = async function(userId) {
  const summary = await this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, '$amount', 0] } },
        totalTransactions: { $sum: 1 },
        successfulTransactions: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
        failedTransactions: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        refundedTransactions: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] } },
        averageTransactionValue: { $avg: { $cond: [{ $eq: ['$status', 'success'] }, '$amount', 0] } },
      },
    },
  ]);
  
  const result = summary[0] || {};
  return {
    totalSpent: result.totalSpent || 0,
    totalTransactions: result.totalTransactions || 0,
    successfulTransactions: result.successfulTransactions || 0,
    failedTransactions: result.failedTransactions || 0,
    refundedTransactions: result.refundedTransactions || 0,
    averageTransactionValue: result.averageTransactionValue || 0,
    successRate: result.totalTransactions > 0 
      ? ((result.successfulTransactions / result.totalTransactions) * 100).toFixed(2)
      : 0,
  };
};

/**
 * Pre-save middleware to ensure transactionId exists
 */
transactionSchema.pre('save', async function(next) {
  if (!this.transactionId) {
    this.transactionId = this.constructor.generateTransactionId();
  }
  
  if (!this.invoiceNumber && this.status === 'success') {
    this.invoiceNumber = this.constructor.generateInvoiceNumber();
  }
  
  next();
});

/**
 * Pre-validate middleware
 */
transactionSchema.pre('validate', function(next) {
  if (this.paymentMethod === 'card' && this.paymentDetails.cardLast4) {
    if (!/^\d{4}$/.test(this.paymentDetails.cardLast4)) {
      next(new Error('Card last 4 digits must be exactly 4 digits'));
    }
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);