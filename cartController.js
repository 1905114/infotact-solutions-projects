const Cart = require('../models/Cart');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const { asyncHandler } = require('../middleware/errorMiddleware');

/**
 * @desc    Get user's cart
 * @route   GET /api/cart
 * @access  Private
 */
const getCart = asyncHandler(async (req, res) => {
  let cart = await Cart.findOne({ userId: req.user.id })
    .populate('restaurantId', 'name images.logo deliverySettings')
    .populate('items.menuItemId', 'name price images isAvailable');

  if (!cart) {
    cart = await Cart.create({
      userId: req.user.id,
      restaurantId: null,
      items: [],
    });
  }

  res.status(200).json({
    success: true,
    data: cart,
  });
});

/**
 * @desc    Add item to cart (with restaurant validation)
 * @route   POST /api/cart/items
 * @access  Private
 */
const addToCart = asyncHandler(async (req, res) => {
  const {
    menuItemId,
    quantity = 1,
    customizations = [],
    specialInstructions = '',
  } = req.body;

  // Get menu item details
  const menuItem = await MenuItem.findById(menuItemId);
  if (!menuItem || !menuItem.isAvailable) {
    return res.status(400).json({
      success: false,
      message: 'Menu item is not available',
    });
  }

  // Get restaurant
  const restaurant = await Restaurant.findById(menuItem.restaurantId);
  if (!restaurant || !restaurant.isActive) {
    return res.status(400).json({
      success: false,
      message: 'Restaurant is not available',
    });
  }

  // Calculate item price with customizations
  let unitPrice = menuItem.discountedPrice || menuItem.price;
  const customizationPrice = customizations.reduce(
    (sum, opt) => sum + (opt.additionalPrice || 0),
    0
  );
  unitPrice += customizationPrice;
  const totalPrice = unitPrice * quantity;

  // Get user's cart
  let cart = await Cart.findOne({ userId: req.user.id });

  // Check if cart has items from different restaurant
  if (cart && cart.restaurantId && cart.restaurantId.toString() !== menuItem.restaurantId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Cannot add items from multiple restaurants. Please clear your cart first.',
      currentRestaurant: cart.restaurantId,
      requestedRestaurant: menuItem.restaurantId,
    });
  }

  // Create or update cart
  if (!cart) {
    cart = await Cart.create({
      userId: req.user.id,
      restaurantId: menuItem.restaurantId,
      items: [],
      deliveryFee: restaurant.deliverySettings.deliveryFee,
    });
  }

  // Check if item already exists in cart
  const existingItemIndex = cart.items.findIndex(
    item => item.menuItemId.toString() === menuItemId &&
      JSON.stringify(item.customizations) === JSON.stringify(customizations)
  );

  if (existingItemIndex > -1) {
    // Update existing item
    cart.items[existingItemIndex].quantity += quantity;
    cart.items[existingItemIndex].totalPrice =
      cart.items[existingItemIndex].unitPrice * cart.items[existingItemIndex].quantity;
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
      isAvailable: true,
    });
  }

  // Recalculate totals
  cart.calculateTotals();
  await cart.save();

  res.status(200).json({
    success: true,
    message: 'Item added to cart successfully',
    data: cart,
  });
});

/**
 * @desc    Update cart item quantity
 * @route   PUT /api/cart/items/:itemId
 * @access  Private
 */
const updateCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) {
    return res.status(404).json({
      success: false,
      message: 'Cart not found',
    });
  }

  const item = cart.items.id(itemId);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Item not found in cart',
    });
  }

  if (quantity <= 0) {
    // Remove item
    item.remove();
  } else {
    item.quantity = quantity;
    item.totalPrice = item.unitPrice * quantity;
  }

  // Remove cart if empty
  if (cart.items.length === 0) {
    await cart.remove();
    return res.status(200).json({
      success: true,
      message: 'Cart is now empty',
      data: null,
    });
  }

  cart.calculateTotals();
  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

/**
 * @desc    Remove item from cart
 * @route   DELETE /api/cart/items/:itemId
 * @access  Private
 */
const removeFromCart = asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) {
    return res.status(404).json({
      success: false,
      message: 'Cart not found',
    });
  }

  const item = cart.items.id(itemId);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Item not found in cart',
    });
  }

  item.remove();

  if (cart.items.length === 0) {
    await cart.remove();
    return res.status(200).json({
      success: true,
      message: 'Cart is now empty',
      data: null,
    });
  }

  cart.calculateTotals();
  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

/**
 * @desc    Clear entire cart
 * @route   DELETE /api/cart
 * @access  Private
 */
const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndDelete({ userId: req.user.id });

  res.status(200).json({
    success: true,
    message: 'Cart cleared successfully',
  });
});

/**
 * @desc    Apply coupon to cart
 * @route   POST /api/cart/coupon
 * @access  Private
 */
const applyCoupon = asyncHandler(async (req, res) => {
  const { couponCode } = req.body;

  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart || cart.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Cart is empty',
    });
  }

  // Mock coupon validation - In production, integrate with coupon service
  const validCoupons = {
    'WELCOME10': { discount: 10, minOrder: 200, type: 'percentage' },
    'SAVE20': { discount: 20, minOrder: 500, type: 'percentage' },
    'FLAT50': { discount: 50, minOrder: 300, type: 'fixed' },
  };

  const coupon = validCoupons[couponCode.toUpperCase()];
  if (!coupon) {
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

  let discountAmount = 0;
  if (coupon.type === 'percentage') {
    discountAmount = (cart.subtotal * coupon.discount) / 100;
  } else {
    discountAmount = coupon.discount;
  }

  cart.couponCode = couponCode.toUpperCase();
  cart.discountAmount = Math.min(discountAmount, cart.subtotal);
  cart.calculateTotals();
  await cart.save();

  res.status(200).json({
    success: true,
    message: 'Coupon applied successfully',
    data: {
      couponCode: cart.couponCode,
      discountAmount: cart.discountAmount,
      totalAmount: cart.totalAmount,
    },
  });
});

/**
 * @desc    Validate cart before checkout
 * @route   GET /api/cart/validate
 * @access  Private
 */
const validateCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });

  if (!cart || cart.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Cart is empty',
      isValid: false,
    });
  }

  const validation = await cart.validateCart();

  res.status(200).json({
    success: validation.isValid,
    ...validation,
  });
});

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  validateCart,
};