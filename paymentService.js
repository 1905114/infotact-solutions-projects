/**
 * Payment Service - Handles mock and real payment gateway integration
 */

const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const Cart = require('../models/Cart');

class PaymentService {
  constructor() {
    this.mockPaymentDelay = 1500;
    this.mockSuccessRate = 0.95;
  }

  /**
   * Process payment through configured gateway
   */
  async processPayment(paymentData) {
    const {
      orderId,
      userId,
      amount,
      paymentMethod,
      gateway = 'mock',
      paymentDetails = {},
    } = paymentData;

    const transactionId = await Transaction.generateTransactionId();

    const transaction = await Transaction.create({
      transactionId,
      orderId,
      userId,
      amount,
      paymentMethod,
      paymentGateway: gateway,
      status: 'processing',
      paymentDetails,
      metadata: {
        ipAddress: paymentDetails.ipAddress,
        userAgent: paymentDetails.userAgent,
      },
    });

    try {
      let result;
      
      switch (gateway) {
        case 'mock':
          result = await this.processMockPayment(transaction, paymentDetails);
          break;
        case 'stripe':
          result = await this.processStripePayment(transaction, paymentDetails);
          break;
        case 'razorpay':
          result = await this.processRazorpayPayment(transaction, paymentDetails);
          break;
        default:
          throw new Error(`Unsupported payment gateway: ${gateway}`);
      }

      transaction.gatewayResponse = result.gatewayResponse;
      
      if (result.success) {
        transaction.status = 'success';
        transaction.paymentDetails.paidAt = new Date();
        await transaction.save();
        
        await Order.findByIdAndUpdate(orderId, {
          paymentStatus: 'completed',
          paymentDetails: {
            transactionId: transaction.transactionId,
            paidAt: new Date(),
            paymentMethod,
          },
        });
        
        await Cart.findOneAndDelete({ userId });
        
        return {
          success: true,
          transaction,
          message: 'Payment processed successfully',
        };
      } else {
        transaction.status = 'failed';
        transaction.failureReason = result.error;
        await transaction.save();
        
        return {
          success: false,
          transaction,
          message: result.error,
        };
      }
    } catch (error) {
      transaction.status = 'failed';
      transaction.failureReason = error.message;
      await transaction.save();
      
      throw error;
    }
  }

  /**
   * Mock Payment Gateway
   */
  async processMockPayment(transaction, paymentDetails) {
    await this.delay(this.mockPaymentDelay);

    const validation = this.validateMockPayment(paymentDetails);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
        gatewayResponse: {
          code: 'VALIDATION_ERROR',
          message: validation.error,
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (paymentDetails.testScenario === 'failure') {
      return {
        success: false,
        error: 'Simulated payment failure for testing',
        gatewayResponse: {
          code: 'TEST_FAILURE',
          message: 'Simulated payment failure',
          timestamp: new Date().toISOString(),
        },
      };
    }

    const isSuccess = Math.random() < this.mockSuccessRate;

    if (isSuccess) {
      const mockReference = `MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      return {
        success: true,
        gatewayResponse: {
          code: 'SUCCESS',
          transactionId: transaction.transactionId,
          gatewayReference: mockReference,
          paymentMethod: transaction.paymentMethod,
          amount: transaction.amount,
          currency: transaction.currency,
          timestamp: new Date().toISOString(),
          bankReference: `BANK_${Date.now()}`,
        },
      };
    } else {
      return {
        success: false,
        error: 'Insufficient funds. Please try a different payment method.',
        gatewayResponse: {
          code: 'INSUFFICIENT_FUNDS',
          message: 'Transaction declined due to insufficient funds',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Validate mock payment details
   */
  validateMockPayment(paymentDetails) {
    const { cardNumber, expiryMonth, expiryYear, cvv, cardHolderName } = paymentDetails;

    if (cardNumber) {
      const last4 = cardNumber.slice(-4);
      
      if (last4 === '0000') {
        return { isValid: false, error: 'Card declined by bank' };
      }
      if (last4 === '9999') {
        return { isValid: false, error: 'Insufficient funds' };
      }
      
      if (!this.luhnCheck(cardNumber)) {
        return { isValid: false, error: 'Invalid card number' };
      }
    }

    if (expiryMonth && expiryYear) {
      const now = new Date();
      const currentYear = now.getFullYear() % 100;
      const currentMonth = now.getMonth() + 1;
      
      if (expiryYear < currentYear || 
          (expiryYear === currentYear && expiryMonth < currentMonth)) {
        return { isValid: false, error: 'Card has expired' };
      }
    }

    if (cvv && (!/^\d{3,4}$/.test(cvv))) {
      return { isValid: false, error: 'Invalid CVV' };
    }

    return { isValid: true };
  }

  /**
   * Luhn algorithm check
   */
  luhnCheck(cardNumber) {
    const digits = cardNumber.replace(/\D/g, '').split('').map(Number);
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = digits[i];
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }

  /**
   * Stripe Payment Gateway Integration
   */
  async processStripePayment(transaction, paymentDetails) {
    // In production: const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    try {
      // Mock implementation for development
      await this.delay(1000);
      
      return {
        success: true,
        gatewayResponse: {
          code: 'SUCCESS',
          gatewayReference: `stripe_${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        gatewayResponse: {
          code: error.code,
          message: error.message,
        },
      };
    }
  }

  /**
   * Razorpay Payment Gateway Integration
   */
  async processRazorpayPayment(transaction, paymentDetails) {
    try {
      await this.delay(1000);
      
      return {
        success: true,
        gatewayResponse: {
          code: 'SUCCESS',
          gatewayReference: `razorpay_${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        gatewayResponse: {
          code: error.code,
          message: error.message,
        },
      };
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId) {
    const transaction = await Transaction.findOne({ transactionId })
      .populate('orderId', 'orderNumber totalAmount status');
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    
    return transaction;
  }

  /**
   * Refund payment
   */
  async refundPayment(transactionId, amount, reason, processedBy) {
    const transaction = await Transaction.findOne({ transactionId });
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    
    if (transaction.status !== 'success') {
      throw new Error('Cannot refund failed or pending transaction');
    }
    
    const refundAmount = amount || transaction.amount;
    
    let refundResult;
    
    switch (transaction.paymentGateway) {
      case 'mock':
        refundResult = await this.processMockRefund(transaction, refundAmount);
        break;
      case 'stripe':
        refundResult = await this.processStripeRefund(transaction, refundAmount);
        break;
      default:
        throw new Error(`Refund not supported for gateway: ${transaction.paymentGateway}`);
    }
    
    if (refundResult.success) {
      transaction.status = refundAmount === transaction.amount ? 'refunded' : 'partially_refunded';
      transaction.refundDetails = {
        refundId: refundResult.refundId,
        refundAmount,
        refundReason: reason,
        refundedAt: new Date(),
        processedBy,
      };
      await transaction.save();
      
      await Order.findByIdAndUpdate(transaction.orderId, {
        paymentStatus: transaction.status,
      });
    }
    
    return refundResult;
  }

  /**
   * Process mock refund
   */
  async processMockRefund(transaction, amount) {
    await this.delay(1000);
    
    return {
      success: true,
      refundId: `REF_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      amount,
      message: 'Refund processed successfully',
    };
  }

  /**
   * Process Stripe refund
   */
  async processStripeRefund(transaction, amount) {
    await this.delay(1000);
    
    return {
      success: true,
      refundId: `re_${Date.now()}`,
      amount,
    };
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new PaymentService();