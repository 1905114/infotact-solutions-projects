const Cart = require('../models/Cart');
const MenuItem = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');

/**
 * Cart Middleware
 * Validates cart operations and prevents multi-restaurant conflicts
 */

/**
 * Validate that cart exists and is not empty
 */
const validateCartExists = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }
    
    if (cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }
    
    req.cart = cart;
    next();
  } catch (error) {
    console.error('Validate cart exists error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating cart',
    });
  }
};

/**
 * Prevent adding items from different restaurants
 * This is the CRITICAL middleware for multi-restaurant conflict prevention
 */
const preventMultiRestaurantConflict = async (req, res, next) => {
  try {
    const { menuItemId } = req.body;
    
    // Get the menu item to check its restaurant
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }
    
    // Get user's current cart
    const cart = await Cart.findOne({ userId: req.user.id });
    
    // If cart has items from a different restaurant, block the operation
    if (cart && cart.restaurantId && cart.items.length > 0) {
      if (cart.restaurantId.toString() !== menuItem.restaurantId.toString()) {
        const restaurant = await Restaurant.findById(cart.restaurantId);
        
        return res.status(409).json({
          success: false,
          message: 'Cannot add items from multiple restaurants',
          error: 'MULTI_RESTAURANT_CONFLICT',
          currentRestaurant: {
            id: cart.restaurantId,
            name: restaurant ? restaurant.name : 'Unknown',
          },
          requestedRestaurant: {
            id: menuItem.restaurantId,
          },
          action: 'clear_cart_or_continue',
        });
      }
    }
    
    // Store menu item info for next middleware
    req.menuItem = menuItem;
    next();
  } catch (error) {
    console.error('Prevent multi-restaurant conflict error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating restaurant conflict',
    });
  }
};

/**
 * Validate menu item availability before adding to cart
 */
const validateMenuItemAvailability = async (req, res, next) => {
  try {
    const { menuItemId, quantity = 1 } = req.body;
    
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }
    
    if (!menuItem.isAvailable) {
      return res.status(400).json({
        success: false,
        message: `"${menuItem.name}" is currently not available`,
      });
    }
    
    // Validate quantity limits
    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1',
      });
    }
    
    if (quantity > 50) {
      return res.status(400).json({
        success: false,
        message: 'Maximum quantity per item is 50',
      });
    }
    
    // Check if restaurant is active
    const restaurant = await Restaurant.findById(menuItem.restaurantId);
    if (!restaurant || !restaurant.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant is currently not available',
      });
    }
    
    req.menuItem = menuItem;
    req.restaurant = restaurant;
    next();
  } catch (error) {
    console.error('Validate menu item availability error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating menu item',
    });
  }
};

/**
 * Validate cart item quantity update
 */
const validateCartItemQuantity = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required',
      });
    }
    
    if (quantity > 50) {
      return res.status(400).json({
        success: false,
        message: 'Maximum quantity per item is 50',
      });
    }
    
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }
    
    const cartItem = cart.items.id(itemId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }
    
    req.cart = cart;
    req.cartItem = cartItem;
    req.quantity = quantity;
    next();
  } catch (error) {
    console.error('Validate cart item quantity error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating quantity',
    });
  }
};

/**
 * Validate coupon before applying
 */
const validateCoupon = async (req, res, next) => {
  try {
    const { couponCode } = req.body;
    
    if (!couponCode || typeof couponCode !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid coupon code is required',
      });
    }
    
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }
    
    // Mock coupon validation - In production, integrate with coupon service
    const validCoupons = {
      'WELCOME10': {
        discount: 10,
        minOrder: 200,
        type: 'percentage',
        maxDiscount: 100,
        valid: true,
      },
      'SAVE20': {
        discount: 20,
        minOrder: 500,
        type: 'percentage',
        maxDiscount: 200,
        valid: true,
      },
      'FLAT50': {
        discount: 50,
        minOrder: 300,
        type: 'fixed',
        maxDiscount: 50,
        valid: true,
      },
      'FREEDELIVERY': {
        discount: 0,
        minOrder: 400,
        type: 'delivery',
        valid: true,
      },
    };
    
    const coupon = validCoupons[couponCode.toUpperCase()];
    
    if (!coupon || !coupon.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired coupon code',
      });
    }
    
    if (cart.subtotal < coupon.minOrder) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minOrder} required for this coupon`,
      });
    }
    
    req.cart = cart;
    req.coupon = coupon;
    req.couponCode = couponCode.toUpperCase();
    next();
  } catch (error) {
    console.error('Validate coupon error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating coupon',
    });
  }
};

/**
 * Validate cart before checkout
 */
const validateCartForCheckout = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id })
      .populate('restaurantId', 'name isActive isOpen deliverySettings address');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }
    
    // Validate restaurant
    if (!cart.restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'No restaurant associated with cart',
      });
    }
    
    const restaurant = cart.restaurantId;
    
    if (!restaurant.isActive) {
      return res.status(400).json({
        success: false,
        message: `Restaurant "${restaurant.name}" is currently inactive`,
      });
    }
    
    // Check if restaurant is open (warning only, not blocking)
    if (!restaurant.isOpen) {
      req.checkoutWarning = `Restaurant "${restaurant.name}" is currently closed. Order may be delayed.`;
    }
    
    // Validate minimum order amount
    if (cart.subtotal < restaurant.deliverySettings.minimumOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is ₹${restaurant.deliverySettings.minimumOrderAmount}. Current subtotal: ₹${cart.subtotal}`,
      });
    }
    
    // Validate each item is still available
    const unavailableItems = [];
    for (const item of cart.items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem || !menuItem.isAvailable) {
        unavailableItems.push(item.name);
      }
    }
    
    if (unavailableItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some items are no longer available',
        unavailableItems,
      });
    }
    
    req.cart = cart;
    req.restaurant = restaurant;
    next();
  } catch (error) {
    console.error('Validate cart for checkout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating cart for checkout',
    });
  }
};

/**
 * Check if cart has items from a specific restaurant
 */
const checkCartRestaurant = (restaurantId) => {
  return async (req, res, next) => {
    try {
      const cart = await Cart.findOne({ userId: req.user.id });
      
      if (cart && cart.restaurantId && cart.restaurantId.toString() !== restaurantId) {
        const currentRestaurant = await Restaurant.findById(cart.restaurantId);
        
        return res.status(409).json({
          success: false,
          message: 'Cart contains items from a different restaurant',
          currentRestaurant: {
            id: cart.restaurantId,
            name: currentRestaurant ? currentRestaurant.name : 'Unknown',
          },
        });
      }
      
      next();
    } catch (error) {
      console.error('Check cart restaurant error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking cart restaurant',
      });
    }
  };
};

/**
 * Clear cart if it exists (for creating new order from different restaurant)
 */
const clearCartIfExists = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    
    if (cart) {
      await cart.remove();
      console.log(`Cart cleared for user ${req.user.id} before adding from new restaurant`);
    }
    
    next();
  } catch (error) {
    console.error('Clear cart error:', error);
    next(); // Continue even if clear fails
  }
};

/**
 * Validate cart item customizations
 */
const validateCartItemCustomizations = async (req, res, next) => {
  try {
    const { menuItemId, customizations = [] } = req.body;
    
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }
    
    // If no customizations required and none provided, skip validation
    if (!menuItem.customizations || menuItem.customizations.length === 0) {
      if (customizations.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'This item does not support customizations',
        });
      }
      req.customizations = customizations;
      return next();
    }
    
    // Validate required customizations
    const requiredCustomizations = menuItem.customizations.filter(c => c.isRequired);
    const providedCustomizationNames = customizations.map(c => c.name);
    
    for (const required of requiredCustomizations) {
      if (!providedCustomizationNames.includes(required.name)) {
        return res.status(400).json({
          success: false,
          message: `Customization "${required.name}" is required`,
        });
      }
    }
    
    // Validate max selections
    for (const customization of menuItem.customizations) {
      const selected = customizations.filter(c => c.name === customization.name);
      
      if (selected.length > customization.maxSelections) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${customization.maxSelections} selection(s) allowed for "${customization.name}"`,
        });
      }
      
      // Validate options exist
      for (const sel of selected) {
        const validOption = customization.options.find(opt => opt.name === sel.optionName);
        if (!validOption) {
          return res.status(400).json({
            success: false,
            message: `Invalid option "${sel.optionName}" for customization "${customization.name}"`,
          });
        }
        
        // Add additional price to customization
        sel.additionalPrice = validOption.additionalPrice || 0;
      }
    }
    
    req.customizations = customizations;
    req.menuItem = menuItem;
    next();
  } catch (error) {
    console.error('Validate cart item customizations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating customizations',
    });
  }
};

/**
 * Rate limit for cart operations (prevent abuse)
 */
const cartRateLimit = (() => {
  const requests = new Map(); // userId -> { count, resetTime }
  
  return (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();
    
    const now = Date.now();
    const userRequests = requests.get(userId);
    
    // Reset if window has passed
    if (userRequests && now > userRequests.resetTime) {
      requests.delete(userId);
    }
    
    const current = requests.get(userId);
    
    if (current && current.count >= 30) { // 30 requests per minute
      return res.status(429).json({
        success: false,
        message: 'Too many cart operations. Please slow down.',
      });
    }
    
    if (current) {
      current.count++;
    } else {
      requests.set(userId, {
        count: 1,
        resetTime: now + 60000, // 1 minute window
      });
    }
    
    next();
  };
})();

/**
 * Log cart operations for debugging
 */
const logCartOperation = (operation) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Store original json method to capture response
    const originalJson = res.json;
    res.json = function(data) {
      const duration = Date.now() - startTime;
      console.log(`[CART] ${operation} - User: ${req.user?.id} - Duration: ${duration}ms - Status: ${res.statusCode}`);
      
      if (data?.success === false) {
        console.log(`[CART] Error: ${data.message}`);
      }
      
      originalJson.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  validateCartExists,
  preventMultiRestaurantConflict,
  validateMenuItemAvailability,
  validateCartItemQuantity,
  validateCoupon,
  validateCartForCheckout,
  checkCartRestaurant,
  clearCartIfExists,
  validateCartItemCustomizations,
  cartRateLimit,
  logCartOperation,
};