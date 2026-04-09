/**
 * Cart Validator Utility
 * Validates cart operations, prevents multi-restaurant conflicts, and ensures data integrity
 */

const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');

class CartValidator {
  /**
   * Validate adding item to cart
   * @param {Object} params - Validation parameters
   * @returns {Object} Validation result
   */
  static async validateAddToCart(params) {
    const {
      userId,
      menuItemId,
      quantity = 1,
      cartRestaurantId = null,
      customizations = [],
    } = params;

    const errors = [];
    const warnings = [];

    // 1. Validate menu item exists and is available
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      errors.push('Menu item not found');
      return { isValid: false, errors, warnings, menuItem: null };
    }

    if (!menuItem.isAvailable) {
      errors.push(`Menu item "${menuItem.name}" is currently not available`);
    }

    // 2. Validate quantity
    if (quantity < 1) {
      errors.push('Quantity must be at least 1');
    }
    if (quantity > 50) {
      errors.push('Maximum quantity per item is 50');
    }

    // 3. Validate restaurant exists and is active
    const restaurant = await Restaurant.findById(menuItem.restaurantId);
    if (!restaurant) {
      errors.push('Restaurant not found');
      return { isValid: false, errors, warnings, menuItem, restaurant: null };
    }

    if (!restaurant.isActive) {
      errors.push(`Restaurant "${restaurant.name}" is currently inactive`);
    }

    if (!restaurant.isOpen) {
      warnings.push(`Restaurant "${restaurant.name}" is currently closed`);
    }

    // 4. CRITICAL: Check multi-restaurant conflict
    if (cartRestaurantId && cartRestaurantId.toString() !== menuItem.restaurantId.toString()) {
      errors.push(
        `Cannot add items from different restaurants. Your cart contains items from "${cartRestaurantId}" but you're trying to add from "${restaurant.name}". Please clear your cart first.`
      );
    }

    // 5. Validate customizations
    if (customizations && customizations.length > 0) {
      const customizationValidation = await this.validateCustomizations(
        menuItem,
        customizations
      );
      if (!customizationValidation.isValid) {
        errors.push(...customizationValidation.errors);
      }
    }

    // 6. Check if item already in cart and validate total quantity
    // This would be checked in the cart service

    // 7. Validate dietary restrictions if user has any
    const user = await User.findById(userId);
    if (user && user.preferences?.dietaryRestrictions?.length > 0) {
      const dietaryValidation = await this.validateDietaryRestrictions(
        menuItem,
        user.preferences.dietaryRestrictions
      );
      if (!dietaryValidation.isValid) {
        warnings.push(...dietaryValidation.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      menuItem,
      restaurant,
      calculatedPrice: this.calculateItemPrice(menuItem, quantity, customizations),
    };
  }

  /**
   * Validate cart before checkout
   * @param {Object} cart - Cart object
   * @param {Object} user - User object
   * @returns {Object} Validation result
   */
  static async validateCartForCheckout(cart, user) {
    const errors = [];
    const warnings = [];

    if (!cart || !cart.items || cart.items.length === 0) {
      errors.push('Cart is empty');
      return { isValid: false, errors, warnings };
    }

    // 1. Validate restaurant
    const restaurant = await Restaurant.findById(cart.restaurantId);
    if (!restaurant) {
      errors.push('Restaurant not found');
      return { isValid: false, errors, warnings };
    }

    if (!restaurant.isActive) {
      errors.push(`Restaurant "${restaurant.name}" is currently inactive`);
    }

    if (!restaurant.isOpen) {
      warnings.push(`Restaurant "${restaurant.name}" is currently closed. Order may be delayed.`);
    }

    // 2. Validate all items in cart
    let subtotal = 0;
    for (const item of cart.items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      
      if (!menuItem) {
        errors.push(`Item "${item.name}" no longer exists`);
        continue;
      }

      if (!menuItem.isAvailable) {
        errors.push(`Item "${item.name}" is no longer available`);
      }

      // Check if price changed
      const currentPrice = menuItem.discountedPrice || menuItem.price;
      if (currentPrice !== item.unitPrice) {
        warnings.push(
          `Price for "${item.name}" has changed from ₹${item.unitPrice} to ₹${currentPrice}`
        );
        item.unitPrice = currentPrice;
        item.totalPrice = currentPrice * item.quantity;
      }

      subtotal += item.totalPrice;
    }

    // 3. Validate minimum order amount
    if (subtotal < restaurant.deliverySettings.minimumOrderAmount) {
      errors.push(
        `Minimum order amount is ₹${restaurant.deliverySettings.minimumOrderAmount}. Your subtotal is ₹${subtotal}`
      );
    }

    // 4. Validate delivery address
    if (!user.address || !user.address.location || !user.address.location.coordinates) {
      errors.push('Please add a delivery address with valid coordinates');
    } else {
      // 5. Validate delivery feasibility
      const deliveryValidation = await this.validateDeliveryFeasibility(
        restaurant,
        user.address.location.coordinates
      );
      
      if (!deliveryValidation.isDeliverable) {
        errors.push(deliveryValidation.message);
      } else {
        cart.deliveryFee = deliveryValidation.deliveryFee;
      }
    }

    // 6. Validate stock/availability
    const stockValidation = await this.validateStockAvailability(cart.items);
    if (!stockValidation.isValid) {
      errors.push(...stockValidation.errors);
    }

    // 7. Validate coupon if applied
    if (cart.couponCode) {
      const couponValidation = await this.validateCoupon(
        cart.couponCode,
        subtotal,
        user.id
      );
      if (!couponValidation.isValid) {
        warnings.push(`Coupon issue: ${couponValidation.message}`);
        cart.couponCode = null;
        cart.discountAmount = 0;
      } else {
        cart.discountAmount = couponValidation.discountAmount;
      }
    }

    // 8. Recalculate totals
    cart.subtotal = subtotal;
    cart.tax = subtotal * 0.05; // 5% tax
    cart.totalAmount = cart.subtotal + cart.deliveryFee + cart.tax - cart.discountAmount;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      cart,
      restaurant,
    };
  }

  /**
   * Validate customizations for a menu item
   * @param {Object} menuItem - Menu item object
   * @param {Array} customizations - Selected customizations
   * @returns {Object} Validation result
   */
  static async validateCustomizations(menuItem, customizations) {
    const errors = [];

    if (!menuItem.customizations || menuItem.customizations.length === 0) {
      if (customizations && customizations.length > 0) {
        errors.push('This item does not support customizations');
      }
      return { isValid: errors.length === 0, errors };
    }

    // Group customizations by name
    const customizationMap = new Map();
    menuItem.customizations.forEach(opt => {
      customizationMap.set(opt.name, opt);
    });

    // Track selected customizations
    const selectedMap = new Map();
    for (const selected of customizations) {
      const option = customizationMap.get(selected.name);
      if (!option) {
        errors.push(`Invalid customization option: ${selected.name}`);
        continue;
      }

      if (!selectedMap.has(selected.name)) {
        selectedMap.set(selected.name, []);
      }
      selectedMap.get(selected.name).push(selected);
    }

    // Validate each customization
    for (const [name, option] of customizationMap) {
      const selected = selectedMap.get(name) || [];
      
      if (option.isRequired && selected.length === 0) {
        errors.push(`Customization "${name}" is required`);
      }

      if (selected.length > option.maxSelections) {
        errors.push(
          `Customization "${name}" allows maximum ${option.maxSelections} selection(s)`
        );
      }

      // Validate options exist
      for (const sel of selected) {
        const validOption = option.options.find(opt => opt.name === sel.optionName);
        if (!validOption) {
          errors.push(`Invalid option "${sel.optionName}" for customization "${name}"`);
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate dietary restrictions
   * @param {Object} menuItem - Menu item object
   * @param {Array} restrictions - User's dietary restrictions
   * @returns {Object} Validation result with warnings
   */
  static async validateDietaryRestrictions(menuItem, restrictions) {
    const warnings = [];
    const restrictionMap = {
      Vegetarian: 'isVegetarian',
      Vegan: 'isVegan',
      'Gluten-Free': 'isGlutenFree',
    };

    for (const restriction of restrictions) {
      const field = restrictionMap[restriction];
      if (field && !menuItem[field]) {
        warnings.push(`Item "${menuItem.name}" is not ${restriction.toLowerCase()}`);
      }
    }

    // Check allergens
    if (menuItem.allergens && menuItem.allergens.length > 0) {
      const userAllergens = restrictions.filter(r => 
        ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Soy', 'Fish', 'Shellfish'].includes(r)
      );
      
      const conflictingAllergens = menuItem.allergens.filter(a => 
        userAllergens.includes(a)
      );
      
      if (conflictingAllergens.length > 0) {
        warnings.push(
          `Item contains allergens: ${conflictingAllergens.join(', ')}`
        );
      }
    }

    return {
      isValid: true, // Warnings don't block checkout
      warnings,
    };
  }

  /**
   * Validate delivery feasibility
   * @param {Object} restaurant - Restaurant object
   * @param {Array} customerCoordinates - [longitude, latitude]
   * @returns {Object} Delivery validation result
   */
  static async validateDeliveryFeasibility(restaurant, customerCoordinates) {
    const [customerLon, customerLat] = customerCoordinates;
    const [restaurantLon, restaurantLat] = restaurant.address.location.coordinates;

    // Calculate distance using Haversine formula
    const distance = this.calculateDistance(
      restaurantLat, restaurantLon,
      customerLat, customerLon
    );

    const isDeliverable = distance <= restaurant.deliverySettings.deliveryRadius;

    if (!isDeliverable) {
      return {
        isDeliverable: false,
        message: `Delivery not available. Distance ${distance.toFixed(1)}km exceeds maximum ${restaurant.deliverySettings.deliveryRadius}km`,
        distance,
      };
    }

    // Calculate delivery fee
    let deliveryFee = restaurant.deliverySettings.deliveryFee;
    
    // Additional fee for long distance
    if (distance > 5) {
      const extraFee = Math.ceil((distance - 5) * 5); // ₹5 per extra km
      deliveryFee += extraFee;
    }

    return {
      isDeliverable: true,
      distance: distance.toFixed(1),
      deliveryFee,
      estimatedTime: this.calculateEstimatedDeliveryTime(
        distance,
        restaurant.deliverySettings.estimatedDeliveryTime
      ),
    };
  }

  /**
   * Validate stock availability
   * @param {Array} items - Cart items
   * @returns {Object} Stock validation result
   */
  static async validateStockAvailability(items) {
    const errors = [];

    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      
      if (menuItem) {
        // Check if item has stock limit (if implemented)
        if (menuItem.maxOrderPerUser && item.quantity > menuItem.maxOrderPerUser) {
          errors.push(
            `Maximum ${menuItem.maxOrderPerUser} ${menuItem.name}(s) allowed per order`
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate coupon
   * @param {string} couponCode - Coupon code
   * @param {number} subtotal - Cart subtotal
   * @param {string} userId - User ID
   * @returns {Object} Coupon validation result
   */
  static async validateCoupon(couponCode, subtotal, userId) {
    // Mock coupon validation - Replace with actual coupon service
    const coupons = {
      'WELCOME10': {
        type: 'percentage',
        value: 10,
        minOrder: 200,
        maxDiscount: 100,
        valid: true,
      },
      'SAVE20': {
        type: 'percentage',
        value: 20,
        minOrder: 500,
        maxDiscount: 200,
        valid: true,
      },
      'FLAT50': {
        type: 'fixed',
        value: 50,
        minOrder: 300,
        maxDiscount: 50,
        valid: true,
      },
      'FREEDELIVERY': {
        type: 'delivery',
        value: 0,
        minOrder: 400,
        valid: true,
      },
    };

    const coupon = coupons[couponCode.toUpperCase()];

    if (!coupon) {
      return {
        isValid: false,
        message: 'Invalid coupon code',
        discountAmount: 0,
      };
    }

    if (!coupon.valid) {
      return {
        isValid: false,
        message: 'Coupon is expired or invalid',
        discountAmount: 0,
      };
    }

    if (subtotal < coupon.minOrder) {
      return {
        isValid: false,
        message: `Minimum order of ₹${coupon.minOrder} required for this coupon`,
        discountAmount: 0,
      };
    }

    let discountAmount = 0;
    if (coupon.type === 'percentage') {
      discountAmount = (subtotal * coupon.value) / 100;
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else if (coupon.type === 'fixed') {
      discountAmount = coupon.value;
    }

    return {
      isValid: true,
      message: 'Coupon applied successfully',
      discountAmount,
      couponType: coupon.type,
    };
  }

  /**
   * Calculate item price with customizations
   * @param {Object} menuItem - Menu item object
   * @param {number} quantity - Quantity
   * @param {Array} customizations - Selected customizations
   * @returns {Object} Price calculation
   */
  static calculateItemPrice(menuItem, quantity, customizations) {
    let basePrice = menuItem.discountedPrice || menuItem.price;
    let customizationsPrice = 0;

    if (customizations && customizations.length > 0) {
      customizationsPrice = customizations.reduce((sum, opt) => {
        return sum + (opt.additionalPrice || 0);
      }, 0);
    }

    const unitPrice = basePrice + customizationsPrice;
    const totalPrice = unitPrice * quantity;

    return {
      unitPrice,
      totalPrice,
      basePrice,
      customizationsPrice,
      quantity,
    };
  }

  /**
   * Calculate distance using Haversine formula
   * @param {number} lat1 - Latitude of first point
   * @param {number} lon1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lon2 - Longitude of second point
   * @returns {number} Distance in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.degToRad(lat2 - lat1);
    const dLon = this.degToRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degToRad(lat1)) * Math.cos(this.degToRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees - Degrees
   * @returns {number} Radians
   */
  static degToRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate estimated delivery time
   * @param {number} distance - Distance in km
   * @param {number} preparationTime - Preparation time in minutes
   * @returns {number} Total estimated time in minutes
   */
  static calculateEstimatedDeliveryTime(distance, preparationTime) {
    const avgSpeed = 30; // km per hour
    const travelTime = (distance / avgSpeed) * 60;
    return Math.ceil(preparationTime + travelTime);
  }

  /**
   * Check if two restaurants are the same
   * @param {string} restaurantId1 - First restaurant ID
   * @param {string} restaurantId2 - Second restaurant ID
   * @returns {boolean} True if same restaurant
   */
  static isSameRestaurant(restaurantId1, restaurantId2) {
    if (!restaurantId1 || !restaurantId2) return false;
    return restaurantId1.toString() === restaurantId2.toString();
  }

  /**
   * Get cart summary with warnings
   * @param {Object} cart - Cart object
   * @returns {Object} Cart summary
   */
  static async getCartSummary(cart) {
    if (!cart || !cart.items || cart.items.length === 0) {
      return {
        isEmpty: true,
        items: [],
        subtotal: 0,
        tax: 0,
        deliveryFee: 0,
        totalAmount: 0,
      };
    }

    const restaurant = await Restaurant.findById(cart.restaurantId);
    const warnings = [];

    // Check if restaurant is open
    if (restaurant && !restaurant.isOpen) {
      warnings.push('Restaurant is currently closed');
    }

    // Check minimum order
    if (restaurant && cart.subtotal < restaurant.deliverySettings.minimumOrderAmount) {
      warnings.push(
        `Add ₹${restaurant.deliverySettings.minimumOrderAmount - cart.subtotal} more to meet minimum order`
      );
    }

    return {
      isEmpty: false,
      restaurantId: cart.restaurantId,
      restaurantName: restaurant?.name,
      items: cart.items.map(item => ({
        id: item._id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        customizations: item.customizations,
      })),
      subtotal: cart.subtotal,
      tax: cart.tax,
      deliveryFee: cart.deliveryFee,
      discount: cart.discountAmount,
      totalAmount: cart.totalAmount,
      couponCode: cart.couponCode,
      warnings,
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  /**
   * Validate cart item quantities (prevent negative or zero)
   * @param {Object} cart - Cart object
   * @returns {Object} Validation result
   */
  static validateCartQuantities(cart) {
    const errors = [];

    for (const item of cart.items) {
      if (item.quantity <= 0) {
        errors.push(`Invalid quantity for ${item.name}`);
      }
      if (item.quantity > 50) {
        errors.push(`Maximum 50 items allowed for ${item.name}`);
      }
      if (item.totalPrice < 0) {
        errors.push(`Invalid price for ${item.name}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for duplicate items in cart
   * @param {Object} cart - Cart object
   * @returns {Array} Duplicate items
   */
  static findDuplicateItems(cart) {
    const itemMap = new Map();
    const duplicates = [];

    for (const item of cart.items) {
      const key = `${item.menuItemId}_${JSON.stringify(item.customizations)}`;
      if (itemMap.has(key)) {
        duplicates.push({
          item: item.name,
          occurrences: itemMap.get(key) + 1,
        });
        itemMap.set(key, itemMap.get(key) + 1);
      } else {
        itemMap.set(key, 1);
      }
    }

    return duplicates;
  }

  /**
   * Merge duplicate items in cart
   * @param {Object} cart - Cart object
   * @returns {Object} Cart with merged items
   */
  static mergeDuplicateItems(cart) {
    const itemMap = new Map();

    for (const item of cart.items) {
      const key = `${item.menuItemId}_${JSON.stringify(item.customizations)}`;
      
      if (itemMap.has(key)) {
        const existing = itemMap.get(key);
        existing.quantity += item.quantity;
        existing.totalPrice = existing.unitPrice * existing.quantity;
      } else {
        itemMap.set(key, item);
      }
    }

    cart.items = Array.from(itemMap.values());
    cart.calculateTotals();
    
    return cart;
  }
}

module.exports = CartValidator;