const mongoose = require('mongoose');

/**
 * CartItem Schema - Individual item in shopping cart
 * This is typically embedded in Cart schema, but standalone for reference
 */
const cartItemSchema = new mongoose.Schema(
  {
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cart',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountedPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    customizations: [
      {
        name: {
          type: String,
          required: true,
        },
        optionName: {
          type: String,
          required: true,
        },
        additionalPrice: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],
    specialInstructions: {
      type: String,
      maxlength: 200,
      trim: true,
      default: null,
    },
    image: {
      type: String,
      default: null,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isVegetarian: {
      type: Boolean,
      default: false,
    },
    spiceLevel: {
      type: String,
      enum: ['Mild', 'Medium', 'Hot', 'Extra Hot', null],
      default: null,
    },
    preparationTime: {
      type: Number,
      default: 15,
      min: 5,
      max: 60,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for efficient queries
cartItemSchema.index({ cartId: 1, menuItemId: 1 });
cartItemSchema.index({ userId: 1, restaurantId: 1 });
cartItemSchema.index({ addedAt: -1 });

/**
 * Virtual for effective price (after discount)
 */
cartItemSchema.virtual('effectivePrice').get(function() {
  return this.discountedPrice || this.unitPrice;
});

/**
 * Calculate total price for this item
 */
cartItemSchema.methods.calculateTotalPrice = function() {
  const customizationsTotal = this.customizations.reduce(
    (sum, opt) => sum + (opt.additionalPrice || 0),
    0
  );
  
  const basePrice = this.discountedPrice || this.unitPrice;
  const finalUnitPrice = basePrice + customizationsTotal;
  this.totalPrice = finalUnitPrice * this.quantity;
  
  return this.totalPrice;
};

/**
 * Update quantity and recalculate total
 */
cartItemSchema.methods.updateQuantity = function(newQuantity) {
  if (newQuantity < 1) {
    throw new Error('Quantity must be at least 1');
  }
  if (newQuantity > 50) {
    throw new Error('Maximum quantity per item is 50');
  }
  
  this.quantity = newQuantity;
  this.calculateTotalPrice();
  this.updatedAt = new Date();
  
  return this;
};

/**
 * Add customization to item
 */
cartItemSchema.methods.addCustomization = function(customization) {
  const existingIndex = this.customizations.findIndex(
    c => c.name === customization.name && c.optionName === customization.optionName
  );
  
  if (existingIndex === -1) {
    this.customizations.push(customization);
    this.calculateTotalPrice();
  }
  
  return this;
};

/**
 * Remove customization from item
 */
cartItemSchema.methods.removeCustomization = function(customizationName, optionName) {
  this.customizations = this.customizations.filter(
    c => !(c.name === customizationName && c.optionName === optionName)
  );
  this.calculateTotalPrice();
  
  return this;
};

/**
 * Check if item has specific customization
 */
cartItemSchema.methods.hasCustomization = function(customizationName, optionName) {
  return this.customizations.some(
    c => c.name === customizationName && 
         (optionName ? c.optionName === optionName : true)
  );
};

module.exports = mongoose.model('CartItem', cartItemSchema);