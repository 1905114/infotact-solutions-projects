/**
 * Payment Webhook Handler - Processes payment gateway callbacks
 */

const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const Cart = require('../models/Cart');

class PaymentWebhookHandler {
  constructor() {
    this.webhookSecret = process.env.WEBHOOK_SECRET || 'your-webhook-secret';
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload, signature, gateway) {
    switch (gateway) {
      case 'stripe':
        return this.verifyStripeSignature(payload, signature);
      case 'razorpay':
        return this.verifyRazorpaySignature(payload, signature);
      case 'mock':
        return true;
      default:
        return false;
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  verifyStripeSignature(payload, signature) {
    // In production, use Stripe's webhook verification
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
    return true;
  }

  /**
   * Verify Razorpay webhook signature
   */
  verifyRazorpaySignature(payload, signature) {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return expectedSignature === signature;
  }

  /**
   * Handle Stripe webhook
   */
  async handleStripeWebhook(event) {
    const { type, data } = event;
    const { object } = data;

    switch (type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess({
          transactionId: object.metadata.transactionId,
          gatewayReference: object.id,
          amount: object.amount / 100,
          currency: object.currency,
          paymentDetails: {
            cardLast4: object.payment_method_details?.card?.last4,
            cardBrand: object.payment_method_details?.card?.brand,
          },
        });
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure({
          transactionId: object.metadata.transactionId,
          error: object.last_payment_error?.message || 'Payment failed',
          gatewayResponse: object,
        });
        break;

      case 'charge.refunded':
        await this.handleRefundSuccess({
          transactionId: object.metadata.transactionId,
          refundId: object.id,
          amount: object.amount_refunded / 100,
        });
        break;

      default:
        console.log(`Unhandled Stripe webhook event: ${type}`);
    }
  }

  /**
   * Handle Razorpay webhook
   */
  async handleRazorpayWebhook(event) {
    const { event: eventType, payload } = event;

    switch (eventType) {
      case 'payment.captured':
        await this.handlePaymentSuccess({
          transactionId: payload.payment.entity.notes?.transactionId,
          gatewayReference: payload.payment.entity.id,
          amount: payload.payment.entity.amount / 100,
          currency: payload.payment.entity.currency,
          paymentDetails: {
            method: payload.payment.entity.method,
            bank: payload.payment.entity.bank,
          },
        });
        break;

      case 'payment.failed':
        await this.handlePaymentFailure({
          transactionId: payload.payment.entity.notes?.transactionId,
          error: payload.payment.entity.error_description || 'Payment failed',
          gatewayResponse: payload.payment.entity,
        });
        break;

      case 'refund.created':
        await this.handleRefundSuccess({
          transactionId: payload.refund.entity.notes?.transactionId,
          refundId: payload.refund.entity.id,
          amount: payload.refund.entity.amount / 100,
        });
        break;

      default:
        console.log(`Unhandled Razorpay webhook event: ${eventType}`);
    }
  }

  /**
   * Handle mock payment webhook
   */
  async handleMockWebhook(data) {
    const { transactionId, status, gatewayReference, error } = data;

    if (status === 'success') {
      await this.handlePaymentSuccess({
        transactionId,
        gatewayReference,
        amount: data.amount,
        currency: 'INR',
        paymentDetails: data.paymentDetails || {},
      });
    } else {
      await this.handlePaymentFailure({
        transactionId,
        error: error || 'Mock payment failed',
        gatewayResponse: data,
      });
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(paymentData) {
    const { transactionId, gatewayReference, amount, currency, paymentDetails } = paymentData;

    const transaction = await Transaction.findOne({ transactionId });
    if (!transaction) {
      console.error(`Transaction not found: ${transactionId}`);
      return;
    }

    if (transaction.status === 'success') {
      console.log(`Transaction already processed: ${transactionId}`);
      return;
    }

    transaction.status = 'success';
    transaction.paymentDetails = {
      ...transaction.paymentDetails,
      ...paymentDetails,
      paidAt: new Date(),
    };
    transaction.gatewayResponse = {
      ...transaction.gatewayResponse,
      gatewayReference,
      webhookProcessedAt: new Date(),
    };
    transaction.webhookReceived = true;
    transaction.webhookProcessedAt = new Date();

    await transaction.save();

    // Update order payment status
    await Order.findByIdAndUpdate(transaction.orderId, {
      paymentStatus: 'completed',
      paymentDetails: {
        transactionId: transaction.transactionId,
        gatewayReference,
        paidAt: new Date(),
        paymentMethod: transaction.paymentMethod,
      },
    });

    // Clear user's cart
    await Cart.findOneAndDelete({ userId: transaction.userId });

    console.log(`Payment successful for transaction ${transactionId}`);
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(failureData) {
    const { transactionId, error, gatewayResponse } = failureData;

    const transaction = await Transaction.findOne({ transactionId });
    if (!transaction) {
      console.error(`Transaction not found: ${transactionId}`);
      return;
    }

    if (transaction.status === 'failed') {
      console.log(`Transaction already marked as failed: ${transactionId}`);
      return;
    }

    transaction.status = 'failed';
    transaction.failureReason = error;
    transaction.gatewayResponse = {
      ...transaction.gatewayResponse,
      ...gatewayResponse,
      webhookProcessedAt: new Date(),
    };
    transaction.webhookReceived = true;
    transaction.webhookProcessedAt = new Date();

    await transaction.save();

    // Update order payment status
    await Order.findByIdAndUpdate(transaction.orderId, {
      paymentStatus: 'failed',
    });

    console.log(`Payment failed for transaction ${transactionId}: ${error}`);
  }

  /**
   * Handle refund success
   */
  async handleRefundSuccess(refundData) {
    const { transactionId, refundId, amount } = refundData;

    const transaction = await Transaction.findOne({ transactionId });
    if (!transaction) {
      console.error(`Transaction not found for refund: ${transactionId}`);
      return;
    }

    transaction.refundDetails = {
      refundId,
      refundAmount: amount,
      refundedAt: new Date(),
    };
    transaction.status = amount === transaction.amount ? 'refunded' : 'partially_refunded';

    await transaction.save();

    // Update order
    await Order.findByIdAndUpdate(transaction.orderId, {
      paymentStatus: transaction.status,
    });

    console.log(`Refund processed for transaction ${transactionId}: ${amount}`);
  }

  /**
   * Main webhook handler
   */
  async handleWebhook(req, gateway) {
    const payload = req.body;
    const signature = req.headers['stripe-signature'] || 
                     req.headers['x-razorpay-signature'] ||
                     req.headers['x-webhook-signature'];

    // Verify signature
    if (!this.verifySignature(payload, signature, gateway)) {
      throw new Error('Invalid webhook signature');
    }

    // Process based on gateway
    switch (gateway) {
      case 'stripe':
        await this.handleStripeWebhook(payload);
        break;
      case 'razorpay':
        await this.handleRazorpayWebhook(payload);
        break;
      case 'mock':
        await this.handleMockWebhook(payload);
        break;
      default:
        throw new Error(`Unsupported gateway: ${gateway}`);
    }

    return { received: true, gateway };
  }
}

module.exports = new PaymentWebhookHandler();