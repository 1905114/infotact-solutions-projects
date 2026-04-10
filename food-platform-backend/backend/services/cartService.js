/**
 * Cart Service - Manages shopping cart operations with restaurant isolation
 */

const Cart = require('../models/Cart');
const MenuItem = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');

class CartService {
  /**
   * Get or create user cart
   */
  async getOrCreateCart(userId) {
    let cart = await Cart.findOne({ userId })
      .populate('restaurantId', 'name images.logo deliverySettings address')
      .populate('items.menuItemId', 'name price images isAvailable');

    if (!cart) {
      cart = await Cart.create({
        userId,
        items: [],
      });
    }

    return cart;
  }

  /**
   * Add item to cart with restaurant conflict checking
   */
  async addToCart(userId, itemData) {
    const { menuItemId, quantity = 1, customizations = [], specialInstructions = '' } = itemData;

    // Get menu item details
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    if (!menuItem.isAvailable) {
      throw new Error(`"${menuItem.name}" is currently not available`);
    }

    // Get restaurant
    const restaurant = await Restaurant.findById(menuItem.restaurantId);
    if (!restaurant || !restaurant.isActive) {
      throw new Error('Restaurant is not available');
    }

    // Get or create cart
    let cart = await this.getOrCreateCart(userId);

    // Check for multi-restaurant conflict
    if (cart.restaurantId && cart.items.length > 0) {
      if (cart.restaurantId.toString() !== menuItem.restaurantId.toString()) {
        throw new Error(`Cannot add items from different restaurants. Your cart contains items from "${cart.restaurantId.name}". Please clear your cart first.`);
      }
    }

    // Calculate item price with customizations
    let unitPrice = menuItem.discountedPrice || menuItem.price;
    const customizationPrice = customizations.reduce((sum, opt) => sum + (opt.additionalPrice || 0), 0);
    unitPrice += customizationPrice;
    const totalPrice = unitPrice * quantity;

    // Set restaurant if not set
    if (!cart.restaurantId) {
      cart.restaurantId = menuItem.restaurantId;
      cart.deliveryFee = restaurant.deliverySettings.deliveryFee;
    }

    // Check if item already exists with same customizations
    const existingItemIndex = cart.items.findIndex(item => {
      if (item.menuItemId.toString() !== menuItemId) return false;
      return JSON.stringify(item.customizations) === JSON.stringify(customizations);
    });

    if (existingItemIndex > -1) {
      // Update existing item
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (newQuantity > 50) {
        throw new Error(`Maximum quantity of 50 allowed for ${menuItem.name}`);
      }
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].totalPrice = cart.items[existingItemIndex].unitPrice * newQuantity;
    } else {
      // Add new item
      cart.items.push({
        menuItemId,
        name: menuItem.name,
        quantity,
        unitPrice,
        totalPrice,
        customizations,
        specialInstructions,
        image: menuItem.images?.[0],
        isAvailable: true,
      });
    }

    // Recalculate totals
    cart.calculateTotals();
    await cart.save();

    return cart;
  }

  /**
   * Update cart item quantity
   */
  async updateItemQuantity(userId, itemId, quantity) {
    const cart = await this.getOrCreateCart(userId);
    
    const item = cart.items.id(itemId);
    if (!item) {
      throw new Error('Item not found in cart');
    }

    if (quantity <= 0) {
      item.remove();
    } else if (quantity > 50) {
      throw new Error(`Maximum quantity of 50 allowed for ${item.name}`);
    } else {
      item.quantity = quantity;
      item.totalPrice = item.unitPrice * quantity;
    }

    // Clear restaurant if cart is empty
    if (cart.items.length === 0) {
      cart.restaurantId = null;
      cart.couponCode = null;
      cart.discountAmount = 0;
    }

    cart.calculateTotals();
    await cart.save();

    return cart;
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId, itemId) {
    const cart = await this.getOrCreateCart(userId);
    
    const item = cart.items.id(itemId);
    if (!item) {
      throw new Error('Item not found in cart');
    }

    item.remove();

    if (cart.items.length === 0) {
      cart.restaurantId = null;
      cart.couponCode = null;
      cart.discountAmount = 0;
    }

    cart.calculateTotals();
    await cart.save();

    return cart;
  }

  /**
   * Clear entire cart
   */
  async clearCart(userId) {
    await Cart.findOneAndDelete({ userId });
    return null;
  }

  /**
   * Apply coupon to cart
   */
  async applyCoupon(userId, couponCode) {
    const cart = await this.getOrCreateCart(userId);
    
    if (cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    // Mock coupon validation - In production, integrate with coupon service
    const validCoupons = {
      'WELCOME10': { discount: 10, minOrder: 200, type: 'percentage', maxDiscount: 100 },
      'SAVE20': { discount: 20, minOrder: 500, type: 'percentage', maxDiscount: 200 },
      'FLAT50': { discount: 50, minOrder: 300, type: 'fixed' },
    };

    const coupon = validCoupons[couponCode.toUpperCase()];
    if (!coupon) {
      throw new Error('Invalid or expired coupon code');
    }

    if (cart.subtotal < coupon.minOrder) {
      throw new Error(`Minimum order amount of ₹${coupon.minOrder} required for this coupon`);
    }

    let discountAmount = 0;
    if (coupon.type === 'percentage') {
      discountAmount = (cart.subtotal * coupon.discount) / 100;
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else {
      discountAmount = coupon.discount;
    }

    cart.couponCode = couponCode.toUpperCase();
    cart.discountAmount = discountAmount;
    cart.calculateTotals();
    await cart.save();

    return cart;
  }

  /**
   * Remove coupon from cart
   */
  async removeCoupon(userId) {
    const cart = await this.getOrCreateCart(userId);
    
    cart.couponCode = null;
    cart.discountAmount = 0;
    cart.calculateTotals();
    await cart.save();

    return cart;
  }

  /**
   * Validate cart before checkout
   */
  async validateCart(userId) {
    const cart = await this.getOrCreateCart(userId);
    
    if (cart.items.length === 0) {
      return { isValid: false, errors: ['Cart is empty'], warnings: [] };
    }

    const errors = [];
    const warnings = [];

    // Validate restaurant
    const restaurant = await Restaurant.findById(cart.restaurantId);
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
    if (cart.subtotal < restaurant.deliverySettings.minimumOrderAmount) {
      errors.push(`Minimum order amount is ₹${restaurant.deliverySettings.minimumOrderAmount}`);
    }

    // Validate each item
    for (const item of cart.items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem || !menuItem.isAvailable) {
        errors.push(`"${item.name}" is no longer available`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      cart,
      restaurant,
    };
  }

  /**
   * Get cart summary
   */
  async getCartSummary(userId) {
    const cart = await this.getOrCreateCart(userId);
    return cart.getSummary();
  }
}

module.exports = new CartService();