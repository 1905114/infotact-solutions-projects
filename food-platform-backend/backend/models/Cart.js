const mongoose = require('mongoose');

/**
 * Cart Schema - Manages user shopping cart with restaurant isolation
 * Prevents adding items from multiple restaurants in the same cart
 */
const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: false,
      index: true,
    },
    items: [
      {
        menuItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
          required: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
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
        },
        isAvailable: {
          type: Boolean,
          default: true,
        },
        image: {
          type: String,
          default: null,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    packagingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponCode: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },
    couponDiscount: {
      type: Number,
      default: 0,
    },
    deliveryAddressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User.savedAddresses',
      default: null,
    },
    notes: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
      index: { expires: 0 }, // TTL index for auto-deletion
    },
    lastActivityAt: {
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

// Indexes for performance
cartSchema.index({ userId: 1, restaurantId: 1 });
cartSchema.index({ createdAt: -1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
cartSchema.index({ lastActivityAt: 1 });

/**
 * Virtual for item count
 */
cartSchema.virtual('itemCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

/**
 * Virtual for unique item count
 */
cartSchema.virtual('uniqueItemCount').get(function() {
  return this.items.length;
});

/**
 * Virtual for cart is empty
 */
cartSchema.virtual('isEmpty').get(function() {
  return this.items.length === 0;
});

/**
 * Virtual for cart summary
 */
cartSchema.virtual('summary').get(function() {
  return {
    itemCount: this.itemCount,
    uniqueItems: this.uniqueItemCount,
    subtotal: this.subtotal,
    deliveryFee: this.deliveryFee,
    tax: this.tax,
    packagingCharge: this.packagingCharge,
    discountAmount: this.discountAmount,
    totalAmount: this.totalAmount,
    savings: this.discountAmount,
  };
});

/**
 * Calculate cart totals
 * Updates subtotal, tax, and totalAmount based on current items
 */
cartSchema.methods.calculateTotals = function() {
  // Calculate subtotal from items
  this.subtotal = this.items.reduce((sum, item) => {
    return sum + (item.unitPrice * item.quantity);
  }, 0);
  
  // Calculate tax (5% GST)
  this.tax = this.subtotal * 0.05;
  
  // Calculate total amount
  this.totalAmount = this.subtotal + this.deliveryFee + this.tax + this.packagingCharge - this.discountAmount;
  
  // Ensure total is not negative
  this.totalAmount = Math.max(0, this.totalAmount);
  
  return this;
};

/**
 * Check if cart is empty
 */
cartSchema.methods.isEmpty = function() {
  return this.items.length === 0;
};

/**
 * Clear all items from cart
 */
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.restaurantId = null;
  this.subtotal = 0;
  this.totalAmount = 0;
  this.discountAmount = 0;
  this.couponCode = null;
  this.couponDiscount = 0;
  this.deliveryFee = 0;
  this.tax = 0;
  this.packagingCharge = 0;
  this.calculateTotals();
  return this;
};

/**
 * Check if cart has items from a specific restaurant
 */
cartSchema.methods.hasRestaurant = function(restaurantId) {
  if (!this.restaurantId) return false;
  return this.restaurantId.toString() === restaurantId.toString();
};

/**
 * Add item to cart
 */
cartSchema.methods.addItem = function(itemData) {
  const {
    menuItemId,
    name,
    quantity,
    unitPrice,
    customizations = [],
    specialInstructions = '',
    image = null,
  } = itemData;
  
  // Check if item already exists with same customizations
  const existingItemIndex = this.items.findIndex(item => {
    if (item.menuItemId.toString() !== menuItemId.toString()) return false;
    
    // Compare customizations
    const currentCustomizations = JSON.stringify(item.customizations);
    const newCustomizations = JSON.stringify(customizations);
    return currentCustomizations === newCustomizations;
  });
  
  if (existingItemIndex > -1) {
    // Update existing item
    const existingItem = this.items[existingItemIndex];
    const newQuantity = existingItem.quantity + quantity;
    
    if (newQuantity > 50) {
      throw new Error(`Maximum quantity of 50 allowed for ${name}`);
    }
    
    existingItem.quantity = newQuantity;
    existingItem.totalPrice = existingItem.unitPrice * newQuantity;
    existingItem.specialInstructions = specialInstructions || existingItem.specialInstructions;
  } else {
    // Add new item
    const totalPrice = unitPrice * quantity;
    
    this.items.push({
      menuItemId,
      name,
      quantity,
      unitPrice,
      totalPrice,
      customizations,
      specialInstructions,
      image,
      addedAt: new Date(),
      isAvailable: true,
    });
  }
  
  this.lastActivityAt = new Date();
  this.calculateTotals();
  
  return this;
};

/**
 * Update item quantity
 */
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.id(itemId);
  
  if (!item) {
    throw new Error('Item not found in cart');
  }
  
  if (quantity <= 0) {
    // Remove item
    item.remove();
  } else if (quantity > 50) {
    throw new Error(`Maximum quantity of 50 allowed for ${item.name}`);
  } else {
    item.quantity = quantity;
    item.totalPrice = item.unitPrice * quantity;
  }
  
  // If no items left, clear restaurant
  if (this.items.length === 0) {
    this.restaurantId = null;
    this.couponCode = null;
    this.discountAmount = 0;
  }
  
  this.lastActivityAt = new Date();
  this.calculateTotals();
  
  return this;
};

/**
 * Remove item from cart
 */
cartSchema.methods.removeItem = function(itemId) {
  const item = this.items.id(itemId);
  
  if (!item) {
    throw new Error('Item not found in cart');
  }
  
  item.remove();
  
  // If no items left, clear restaurant
  if (this.items.length === 0) {
    this.restaurantId = null;
    this.couponCode = null;
    this.discountAmount = 0;
  }
  
  this.lastActivityAt = new Date();
  this.calculateTotals();
  
  return this;
};

/**
 * Apply coupon to cart
 */
cartSchema.methods.applyCoupon = function(couponCode, discountAmount) {
  this.couponCode = couponCode;
  this.discountAmount = discountAmount;
  this.calculateTotals();
  return this;
};

/**
 * Remove coupon from cart
 */
cartSchema.methods.removeCoupon = function() {
  this.couponCode = null;
  this.discountAmount = 0;
  this.calculateTotals();
  return this;
};

/**
 * Update delivery fee
 */
cartSchema.methods.updateDeliveryFee = function(deliveryFee) {
  this.deliveryFee = deliveryFee;
  this.calculateTotals();
  return this;
};

/**
 * Update packaging charge
 */
cartSchema.methods.updatePackagingCharge = function(packagingCharge) {
  this.packagingCharge = packagingCharge;
  this.calculateTotals();
  return this;
};

/**
 * Validate cart before checkout
 */
cartSchema.methods.validateCart = async function() {
  const errors = [];
  const warnings = [];
  
  // Check if cart is empty
  if (this.isEmpty()) {
    errors.push('Cart is empty');
    return { isValid: false, errors, warnings };
  }
  
  // Check if restaurant exists and is active
  const Restaurant = mongoose.model('Restaurant');
  const restaurant = await Restaurant.findById(this.restaurantId);
  
  if (!restaurant) {
    errors.push('Restaurant not found');
    return { isValid: false, errors, warnings };
  }
  
  if (!restaurant.isActive) {
    errors.push('Restaurant is currently inactive');
  }
  
  if (!restaurant.isOpen) {
    warnings.push('Restaurant is currently closed. Order may be delayed.');
  }
  
  // Check minimum order amount
  if (this.subtotal < restaurant.deliverySettings.minimumOrderAmount) {
    errors.push(`Minimum order amount is ₹${restaurant.deliverySettings.minimumOrderAmount}`);
  }
  
  // Check each item availability
  const MenuItem = mongoose.model('MenuItem');
  const unavailableItems = [];
  const priceChangedItems = [];
  
  for (const item of this.items) {
    const menuItem = await MenuItem.findById(item.menuItemId);
    
    if (!menuItem) {
      unavailableItems.push(item.name);
      continue;
    }
    
    if (!menuItem.isAvailable) {
      unavailableItems.push(item.name);
    }
    
    // Check if price changed
    const currentPrice = menuItem.discountedPrice || menuItem.price;
    if (currentPrice !== item.unitPrice) {
      priceChangedItems.push({
        name: item.name,
        oldPrice: item.unitPrice,
        newPrice: currentPrice,
      });
      item.unitPrice = currentPrice;
      item.totalPrice = currentPrice * item.quantity;
    }
  }
  
  if (unavailableItems.length > 0) {
    errors.push(`Some items are no longer available: ${unavailableItems.join(', ')}`);
  }
  
  if (priceChangedItems.length > 0) {
    warnings.push('Some item prices have changed');
    this.calculateTotals();
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    restaurant,
    priceChangedItems,
  };
};

/**
 * Get cart summary for response
 */
cartSchema.methods.getSummary = function() {
  return {
    id: this._id,
    userId: this.userId,
    restaurantId: this.restaurantId,
    items: this.items.map(item => ({
      id: item._id,
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      customizations: item.customizations,
      specialInstructions: item.specialInstructions,
      image: item.image,
    })),
    summary: this.summary,
    couponCode: this.couponCode,
    discountAmount: this.discountAmount,
    notes: this.notes,
    lastActivityAt: this.lastActivityAt,
    expiresAt: this.expiresAt,
  };
};

/**
 * Merge another cart into this cart (for guest cart to user cart)
 */
cartSchema.methods.mergeCart = function(otherCart) {
  if (!otherCart || otherCart.items.length === 0) {
    return this;
  }
  
  // Check restaurant conflict
  if (this.restaurantId && otherCart.restaurantId && 
      this.restaurantId.toString() !== otherCart.restaurantId.toString()) {
    throw new Error('Cannot merge carts from different restaurants');
  }
  
  // Set restaurant if not set
  if (!this.restaurantId && otherCart.restaurantId) {
    this.restaurantId = otherCart.restaurantId;
  }
  
  // Merge items
  for (const item of otherCart.items) {
    try {
      this.addItem({
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        customizations: item.customizations,
        specialInstructions: item.specialInstructions,
        image: item.image,
      });
    } catch (error) {
      console.error('Error merging cart item:', error);
    }
  }
  
  this.lastActivityAt = new Date();
  this.calculateTotals();
  
  return this;
};

/**
 * Static method to get or create cart for user
 */
cartSchema.statics.getOrCreateCart = async function(userId) {
  let cart = await this.findOne({ userId });
  
  if (!cart) {
    cart = await this.create({
      userId,
      items: [],
    });
  }
  
  return cart;
};

/**
 * Static method to clear expired carts (called by cron job)
 */
cartSchema.statics.clearExpiredCarts = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  
  console.log(`Cleared ${result.deletedCount} expired carts`);
  return result;
};

/**
 * Pre-save middleware to ensure restaurant consistency
 */
cartSchema.pre('save', function(next) {
  // If cart has items and no restaurant, set restaurant from first item
  if (this.items.length > 0 && !this.restaurantId) {
    // This should be set when adding items, but as fallback
    console.warn('Cart has items but no restaurantId');
  }
  
  // Ensure totals are calculated
  if (this.isModified('items')) {
    this.calculateTotals();
  }
  
  this.lastActivityAt = new Date();
  next();
});

/**
 * Pre-remove middleware for logging
 */
cartSchema.pre('remove', function(next) {
  console.log(`Cart removed for user ${this.userId} with ${this.items.length} items`);
  next();
});

module.exports = mongoose.model('Cart', cartSchema);