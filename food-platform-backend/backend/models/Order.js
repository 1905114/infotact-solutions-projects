const mongoose = require('mongoose');

/**
 * Order Schema - Supports both delivery and dine-in
 */
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    orderType: {
      type: String,
      enum: ['delivery', 'dine-in', 'takeaway'],
      required: true,
    },
    
    // Order items
    items: [{
      menuItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem',
        required: true,
      },
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      unitPrice: { type: Number, required: true },
      totalPrice: { type: Number, required: true },
      customizations: [{
        name: String,
        optionName: String,
        additionalPrice: Number,
      }],
      specialInstructions: String,
    }],
    
    // Pricing
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    serviceCharge: {
      type: Number,
      default: 0,
    },
    packagingCharge: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Payment
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'online'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentDetails: {
      transactionId: String,
      paymentGateway: String,
      paidAt: Date,
    },
    
    // Delivery/Dine-in specific details
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      location: {
        type: {
          type: String,
          enum: ['Point'],
        },
        coordinates: [Number],
      },
      instructions: String,
    },
    
    dineInDetails: {
      tableNumber: String,
      numberOfGuests: Number,
      reservationTime: Date,
    },
    
    // Order status tracking
    status: {
      type: String,
      enum: [
        'pending',           // Order placed, awaiting restaurant confirmation
        'confirmed',         // Restaurant confirmed order
        'preparing',         // Restaurant is preparing food
        'ready',            // Food is ready for pickup/delivery
        'out-for-delivery',  // Delivery partner picked up
        'delivered',        // Order delivered to customer
        'completed',        // Order completed (dine-in)
        'cancelled',        // Order cancelled
        'refunded',         // Order refunded
      ],
      default: 'pending',
    },
    
    statusHistory: [{
      status: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      note: String,
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }],
    
    // Timeline
    orderPlacedAt: {
      type: Date,
      default: Date.now,
    },
    confirmedAt: Date,
    preparationStartedAt: Date,
    readyAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    
    // Delivery partner (if delivery order)
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    // Ratings and feedback
    rating: {
      foodRating: { type: Number, min: 1, max: 5 },
      deliveryRating: { type: Number, min: 1, max: 5 },
      overallRating: { type: Number, min: 1, max: 5 },
      review: String,
      ratedAt: Date,
    },
    
    // Promotions
    couponCode: String,
    couponDiscount: Number,
    
    // Special requests
    specialInstructions: String,
    
    // Cancellation reason
    cancellationReason: String,
  },
  {
    timestamps: true,
  }
);

// Indexes for optimized queries
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, status: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ deliveryPartnerId: 1, status: 1 });
orderSchema.index({ status: 1, orderPlacedAt: 1 });
orderSchema.index({ 'deliveryAddress.location': '2dsphere' });
orderSchema.index({ orderType: 1 });

/**
 * Generate unique order number
 */
orderSchema.statics.generateOrderNumber = async function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${year}${month}${day}-${random}`;
};

/**
 * Update order status with timestamp
 */
orderSchema.methods.updateStatus = function(newStatus, note, updatedBy) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note,
    updatedBy,
  });
  
  // Update specific timestamps based on status
  const timestampFields = {
    confirmed: 'confirmedAt',
    preparing: 'preparationStartedAt',
    ready: 'readyAt',
    'out-for-delivery': 'pickedUpAt',
    delivered: 'deliveredAt',
    completed: 'completedAt',
    cancelled: 'cancelledAt',
  };
  
  if (timestampFields[newStatus]) {
    this[timestampFields[newStatus]] = new Date();
  }
  
  return this.save();
};

module.exports = mongoose.model('Order', orderSchema);