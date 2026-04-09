const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { createOrderStatusEvent, createNotificationEvent } = require('../websocket/events');
const paymentService = require('../services/paymentService');

// WebSocket server instance (will be set from server.js)
let wsController = null;

const setWebSocketController = (controller) => {
  wsController = controller;
};

/**
 * @desc    Create new order from cart
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = asyncHandler(async (req, res) => {
  const { deliveryAddressId, specialInstructions, paymentMethod = 'cash' } = req.body;

  // Get user's cart
  const cart = await Cart.findOne({ userId: req.user.id })
    .populate('restaurantId', 'name deliverySettings contactInfo address');

  if (!cart || cart.items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Cart is empty',
    });
  }

  // Validate cart
  const validation = await validateCartForOrder(cart, req.user.id);
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'Cart validation failed',
      errors: validation.errors,
      warnings: validation.warnings,
    });
  }

  // Get user and delivery address
  const user = await User.findById(req.user.id);
  let deliveryAddress = null;

  if (deliveryAddressId) {
    deliveryAddress = user.savedAddresses.id(deliveryAddressId);
  } else {
    deliveryAddress = user.address;
  }

  if (!deliveryAddress || !deliveryAddress.location || !deliveryAddress.location.coordinates) {
    return res.status(400).json({
      success: false,
      message: 'Valid delivery address with coordinates is required',
    });
  }

  // Calculate delivery fee and estimated time
  const deliveryInfo = await calculateDeliveryInfo(
    cart.restaurantId,
    deliveryAddress.location.coordinates
  );

  if (!deliveryInfo.isDeliverable) {
    return res.status(400).json({
      success: false,
      message: deliveryInfo.message,
    });
  }

  // Generate unique order number
  const orderNumber = await Order.generateOrderNumber();

  // Calculate totals
  const subtotal = cart.subtotal;
  const tax = subtotal * 0.05; // 5% GST
  const deliveryFee = deliveryInfo.deliveryFee;
  const discountAmount = cart.discountAmount || 0;
  const totalAmount = subtotal + tax + deliveryFee - discountAmount;

  // Create order
  const order = await Order.create({
    orderNumber,
    userId: req.user.id,
    restaurantId: cart.restaurantId._id,
    orderType: 'delivery',
    items: cart.items.map(item => ({
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      customizations: item.customizations,
      specialInstructions: item.specialInstructions,
    })),
    subtotal,
    tax,
    deliveryFee,
    discountAmount,
    totalAmount,
    paymentMethod,
    paymentStatus: paymentMethod === 'cash' ? 'pending' : 'pending',
    deliveryAddress: {
      street: deliveryAddress.street,
      city: deliveryAddress.city,
      state: deliveryAddress.state,
      postalCode: deliveryAddress.postalCode,
      location: deliveryAddress.location,
      instructions: specialInstructions,
    },
    status: 'pending',
    statusHistory: [{
      status: 'pending',
      timestamp: new Date(),
      note: 'Order placed successfully',
      updatedBy: req.user.id,
    }],
    couponCode: cart.couponCode,
    orderPlacedAt: new Date(),
  });

  // Clear cart after successful order creation
  await Cart.findOneAndDelete({ userId: req.user.id });

  // Get populated order for response
  const populatedOrder = await Order.findById(order._id)
    .populate('restaurantId', 'name address contactInfo images')
    .populate('userId', 'firstName lastName email phoneNumber');

  // Send real-time notifications via WebSocket
  if (wsController) {
    // Notify customer
    wsController.sendToUser(req.user.id, {
      type: 'ORDER_CREATED',
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      estimatedDeliveryTime: deliveryInfo.estimatedTime,
      timestamp: new Date().toISOString(),
    });

    // Notify restaurant owner
    const restaurant = cart.restaurantId;
    if (restaurant && restaurant.ownerId) {
      wsController.sendToUser(restaurant.ownerId.toString(), {
        type: 'NEW_ORDER_RECEIVED',
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName: `${user.firstName} ${user.lastName}`,
        customerPhone: user.phoneNumber,
        totalAmount: order.totalAmount,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    // Broadcast order status event
    const statusEvent = createOrderStatusEvent(
      order,
      null,
      'pending',
      { id: req.user.id, name: `${user.firstName} ${user.lastName}`, role: 'customer' }
    );
    wsController.broadcastOrderStatus(order._id, 'pending', statusEvent);
  }

  // If payment method is not cash, initiate payment
  let paymentResult = null;
  if (paymentMethod !== 'cash') {
    paymentResult = await paymentService.processPayment({
      orderId: order._id,
      userId: req.user.id,
      amount: totalAmount,
      paymentMethod,
      gateway: 'mock', // Use mock for testing, can be configurable
      paymentDetails: {
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    if (paymentResult.success) {
      order.paymentStatus = 'completed';
      await order.save();
    } else {
      // Order created but payment failed
      return res.status(201).json({
        success: true,
        warning: 'Order created but payment failed. Please retry payment.',
        data: {
          order: populatedOrder,
          paymentStatus: 'failed',
          paymentError: paymentResult.message,
        },
      });
    }
  }

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: {
      order: populatedOrder,
      deliveryInfo,
      paymentStatus: order.paymentStatus,
    },
  });
});

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id)
    .populate('restaurantId', 'name address contactInfo images cuisineTypes averageRating')
    .populate('userId', 'firstName lastName email phoneNumber address')
    .populate('deliveryPartnerId', 'firstName lastName phoneNumber');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  // Check authorization
  const isAuthorized = 
    order.userId._id.toString() === req.user.id ||
    (order.restaurantId && order.restaurantId.ownerId && order.restaurantId.ownerId.toString() === req.user.id) ||
    (order.deliveryPartnerId && order.deliveryPartnerId._id.toString() === req.user.id) ||
    req.user.role === 'admin';

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this order',
    });
  }

  res.status(200).json({
    success: true,
    data: order,
  });
});

/**
 * @desc    Get user's orders
 * @route   GET /api/orders/my-orders
 * @access  Private
 */
const getMyOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    orderType,
    startDate,
    endDate,
  } = req.query;

  const filter = { userId: req.user.id };

  if (status) filter.status = status;
  if (orderType) filter.orderType = orderType;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const orders = await Order.find(filter)
    .populate('restaurantId', 'name images.logo address.city')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Order.countDocuments(filter);

  // Get order statistics
  const stats = await getOrderStats(req.user.id);

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    stats,
    data: orders,
  });
});

/**
 * @desc    Get restaurant orders (for restaurant owner)
 * @route   GET /api/orders/restaurant/:restaurantId
 * @access  Private (Restaurant Owner)
 */
const getRestaurantOrders = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const {
    page = 1,
    limit = 20,
    status,
    date,
    startDate,
    endDate,
  } = req.query;

  // Verify restaurant ownership
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  if (restaurant.ownerId.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view orders for this restaurant',
    });
  }

  const filter = { restaurantId };

  if (status) filter.status = status;
  
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  } else if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const orders = await Order.find(filter)
    .populate('userId', 'firstName lastName email phoneNumber')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Order.countDocuments(filter);

  // Get today's stats
  const todayStats = await getTodayRestaurantStats(restaurantId);

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    todayStats,
    data: orders,
  });
});

/**
 * @desc    Update order status (with WebSocket broadcast)
 * @route   PATCH /api/orders/:id/status
 * @access  Private (Restaurant Owner/Admin/Delivery Partner)
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  const order = await Order.findById(id)
    .populate('userId', 'firstName lastName email phoneNumber')
    .populate('restaurantId', 'name ownerId address contactInfo')
    .populate('deliveryPartnerId', 'firstName lastName phoneNumber');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  // Check authorization
  const isRestaurantOwner = order.restaurantId.ownerId && 
    order.restaurantId.ownerId.toString() === req.user.id;
  const isDeliveryPartner = order.deliveryPartnerId && 
    order.deliveryPartnerId._id.toString() === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isRestaurantOwner && !isDeliveryPartner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this order',
    });
  }

  // Validate status transition
  const oldStatus = order.status;
  const allowedTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['out-for-delivery', 'cancelled'],
    'out-for-delivery': ['delivered', 'cancelled'],
    delivered: ['completed'],
    completed: [],
    cancelled: [],
    refunded: [],
  };

  if (!allowedTransitions[oldStatus]?.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status transition from ${oldStatus} to ${status}`,
    });
  }

  // Update order status
  await order.updateStatus(status, note, req.user);

  // Send real-time WebSocket notifications
  if (wsController) {
    const statusEvent = createOrderStatusEvent(
      order,
      oldStatus,
      status,
      { id: req.user.id, name: req.user.firstName, role: req.user.role }
    );

    // Broadcast to all subscribers
    wsController.broadcastOrderStatus(order._id, status, statusEvent);

    // Send specific notifications based on status
    const statusMessages = {
      confirmed: {
        title: 'Order Confirmed',
        message: `Your order #${order.orderNumber} has been confirmed by the restaurant.`,
        type: 'success',
      },
      preparing: {
        title: 'Order Being Prepared',
        message: `Great news! The restaurant is now preparing your order #${order.orderNumber}.`,
        type: 'info',
      },
      ready: {
        title: 'Order Ready',
        message: `Your order #${order.orderNumber} is ready for pickup/delivery.`,
        type: 'info',
      },
      'out-for-delivery': {
        title: 'Order Out for Delivery',
        message: `Your order #${order.orderNumber} is out for delivery! Track your delivery partner in real-time.`,
        type: 'info',
      },
      delivered: {
        title: 'Order Delivered',
        message: `Your order #${order.orderNumber} has been delivered. Enjoy your meal!`,
        type: 'success',
      },
      cancelled: {
        title: 'Order Cancelled',
        message: `Your order #${order.orderNumber} has been cancelled. Reason: ${note || 'No reason provided'}`,
        type: 'error',
      },
    };

    if (statusMessages[status]) {
      wsController.sendNotification(
        order.userId._id,
        statusMessages[status].title,
        statusMessages[status].message,
        statusMessages[status].type,
        { orderId: order._id, orderNumber: order.orderNumber, status }
      );
    }

    // If order is out for delivery, send delivery partner info
    if (status === 'out-for-delivery' && order.deliveryPartnerId) {
      wsController.sendToUser(order.userId._id, {
        type: 'DELIVERY_PARTNER_ASSIGNED',
        orderId: order._id,
        deliveryPartner: {
          name: `${order.deliveryPartnerId.firstName} ${order.deliveryPartnerId.lastName}`,
          phone: order.deliveryPartnerId.phoneNumber,
        },
        trackingUrl: `/orders/${order._id}/track`,
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `Order status updated to ${status}`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      oldStatus,
      newStatus: status,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * @desc    Assign delivery partner to order
 * @route   POST /api/orders/:id/assign-delivery
 * @access  Private (Restaurant Owner/Admin)
 */
const assignDeliveryPartner = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deliveryPartnerId } = req.body;

  const order = await Order.findById(id)
    .populate('userId', 'firstName lastName email phoneNumber address')
    .populate('restaurantId', 'name address contactInfo');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  if (order.status !== 'ready') {
    return res.status(400).json({
      success: false,
      message: 'Order must be ready before assigning delivery partner',
    });
  }

  const deliveryPartner = await User.findById(deliveryPartnerId);
  if (!deliveryPartner || deliveryPartner.role !== 'delivery_partner') {
    return res.status(404).json({
      success: false,
      message: 'Delivery partner not found',
    });
  }

  if (!deliveryPartner.isActive) {
    return res.status(400).json({
      success: false,
      message: 'Delivery partner is not active',
    });
  }

  order.deliveryPartnerId = deliveryPartnerId;
  await order.updateStatus('out-for-delivery', 'Delivery partner assigned', req.user);

  // Send WebSocket notifications
  if (wsController) {
    // Notify customer
    wsController.sendNotification(
      order.userId._id,
      'Delivery Partner Assigned',
      `A delivery partner has been assigned to your order #${order.orderNumber}`,
      'info',
      {
        orderId: order._id,
        deliveryPartner: {
          name: `${deliveryPartner.firstName} ${deliveryPartner.lastName}`,
          phone: deliveryPartner.phoneNumber,
        },
      }
    );

    // Notify delivery partner
    wsController.sendToUser(deliveryPartnerId, {
      type: 'NEW_DELIVERY_ASSIGNED',
      orderId: order._id,
      orderNumber: order.orderNumber,
      restaurant: {
        name: order.restaurantId.name,
        address: order.restaurantId.address,
        phone: order.restaurantId.contactInfo.phone,
      },
      customer: {
        name: `${order.userId.firstName} ${order.userId.lastName}`,
        phone: order.userId.phoneNumber,
        address: order.deliveryAddress,
      },
      totalAmount: order.totalAmount,
      estimatedDistance: order.deliveryInfo?.distance,
    });
  }

  res.status(200).json({
    success: true,
    message: 'Delivery partner assigned successfully',
    data: {
      orderId: order._id,
      deliveryPartner: {
        id: deliveryPartner._id,
        name: `${deliveryPartner.firstName} ${deliveryPartner.lastName}`,
        phone: deliveryPartner.phoneNumber,
      },
    },
  });
});

/**
 * @desc    Update delivery partner location (real-time tracking)
 * @route   POST /api/orders/:id/location
 * @access  Private (Delivery Partner)
 */
const updateDeliveryLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;

  const order = await Order.findById(id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  if (order.deliveryPartnerId?.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update location for this order',
    });
  }

  if (order.status !== 'out-for-delivery') {
    return res.status(400).json({
      success: false,
      message: 'Can only update location when order is out for delivery',
    });
  }

  // Save location to order (optional)
  order.deliveryInfo = order.deliveryInfo || {};
  order.deliveryInfo.currentLocation = {
    coordinates: [longitude, latitude],
    updatedAt: new Date(),
  };
  await order.save();

  // Send real-time location update via WebSocket
  if (wsController) {
    wsController.sendToUser(order.userId.toString(), {
      type: 'DELIVERY_LOCATION_UPDATE',
      orderId: order._id,
      location: {
        lat: latitude,
        lng: longitude,
        timestamp: new Date().toISOString(),
      },
    });
  }

  res.status(200).json({
    success: true,
    message: 'Location updated',
    data: {
      orderId: order._id,
      location: { latitude, longitude },
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * @desc    Cancel order
 * @route   POST /api/orders/:id/cancel
 * @access  Private
 */
const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const order = await Order.findById(id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  // Check authorization
  const isOwner = order.userId.toString() === req.user.id;
  const isRestaurantOwner = order.restaurantId.ownerId?.toString() === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isRestaurantOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to cancel this order',
    });
  }

  // Check if order can be cancelled
  const cancellableStatuses = ['pending', 'confirmed'];
  if (!cancellableStatuses.includes(order.status)) {
    return res.status(400).json({
      success: false,
      message: `Order cannot be cancelled in ${order.status} status`,
    });
  }

  // Cancel order
  await order.updateStatus('cancelled', reason || 'Order cancelled by user', req.user);

  // Process refund if payment was completed
  if (order.paymentStatus === 'completed') {
    const transaction = await Transaction.findOne({ orderId: order._id });
    if (transaction && transaction.status === 'success') {
      await paymentService.refundPayment(
        transaction.transactionId,
        order.totalAmount,
        reason || 'Order cancelled'
      );
    }
  }

  // Send WebSocket notification
  if (wsController) {
    wsController.sendNotification(
      order.userId.toString(),
      'Order Cancelled',
      `Your order #${order.orderNumber} has been cancelled. ${reason ? `Reason: ${reason}` : ''}`,
      'warning',
      { orderId: order._id }
    );
  }

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: {
      orderId: order._id,
      status: order.status,
      refundProcessed: order.paymentStatus === 'completed',
    },
  });
});

/**
 * @desc    Get order tracking information
 * @route   GET /api/orders/:id/track
 * @access  Private
 */
const trackOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id)
    .populate('restaurantId', 'name address location')
    .populate('deliveryPartnerId', 'firstName lastName phoneNumber');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  // Check authorization
  const isAuthorized = 
    order.userId.toString() === req.user.id ||
    order.deliveryPartnerId?.toString() === req.user.id ||
    req.user.role === 'admin';

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to track this order',
    });
  }

  // Calculate estimated remaining time
  let estimatedRemainingTime = null;
  if (order.status === 'out-for-delivery' && order.deliveryInfo?.distance) {
    const avgSpeed = 30; // km/h
    const remainingTime = (order.deliveryInfo.distance / avgSpeed) * 60;
    estimatedRemainingTime = Math.ceil(remainingTime);
  }

  res.status(200).json({
    success: true,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      statusHistory: order.statusHistory,
      orderPlacedAt: order.orderPlacedAt,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      estimatedRemainingTime,
      restaurant: {
        name: order.restaurantId.name,
        address: order.restaurantId.address,
        location: order.restaurantId.address.location,
      },
      deliveryPartner: order.deliveryPartnerId ? {
        name: `${order.deliveryPartnerId.firstName} ${order.deliveryPartnerId.lastName}`,
        phone: order.deliveryPartnerId.phoneNumber,
        currentLocation: order.deliveryInfo?.currentLocation || null,
      } : null,
      deliveryAddress: order.deliveryAddress,
    },
  });
});

/**
 * @desc    Rate order (after delivery)
 * @route   POST /api/orders/:id/rate
 * @access  Private
 */
const rateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { foodRating, deliveryRating, overallRating, review } = req.body;

  const order = await Order.findById(id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  if (order.userId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to rate this order',
    });
  }

  if (order.status !== 'delivered' && order.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Can only rate orders that have been delivered',
    });
  }

  if (order.rating && order.rating.ratedAt) {
    return res.status(400).json({
      success: false,
      message: 'Order already rated',
    });
  }

  order.rating = {
    foodRating: foodRating || null,
    deliveryRating: deliveryRating || null,
    overallRating: overallRating || Math.round((foodRating + deliveryRating) / 2),
    review: review || null,
    ratedAt: new Date(),
  };

  await order.save();

  // Update restaurant rating
  await updateRestaurantRating(order.restaurantId);

  res.status(200).json({
    success: true,
    message: 'Thank you for your rating!',
    data: order.rating,
  });
});

/**
 * @desc    Get order analytics (admin only)
 * @route   GET /api/orders/analytics
 * @access  Private/Admin
 */
const getOrderAnalytics = asyncHandler(async (req, res) => {
  const { period = 'month' } = req.query;

  let dateFilter = {};
  const now = new Date();
  
  switch (period) {
    case 'week':
      dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
      break;
    case 'month':
      dateFilter = { createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) } };
      break;
    case 'year':
      dateFilter = { createdAt: { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) } };
      break;
  }

  const analytics = await Order.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' },
        completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        totalDeliveryFees: { $sum: '$deliveryFee' },
      },
    },
  ]);

  // Daily order trend
  const dailyTrend = await Order.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        orders: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Top restaurants
  const topRestaurants = await Order.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$restaurantId',
        orderCount: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'restaurants',
        localField: '_id',
        foreignField: '_id',
        as: 'restaurant',
      },
    },
  ]);

  res.status(200).json({
    success: true,
    period,
    data: analytics[0] || {},
    dailyTrend,
    topRestaurants,
  });
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Validate cart before creating order
 */
async function validateCartForOrder(cart, userId) {
  const errors = [];
  const warnings = [];

  if (!cart.restaurantId) {
    errors.push('Restaurant not found');
    return { isValid: false, errors, warnings };
  }

  const restaurant = cart.restaurantId;

  // Check if restaurant is active
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
    if (!item.isAvailable) {
      errors.push(`${item.name} is no longer available`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate delivery information
 */
async function calculateDeliveryInfo(restaurant, customerCoordinates) {
  const [customerLon, customerLat] = customerCoordinates;
  const [restaurantLon, restaurantLat] = restaurant.address.location.coordinates;

  // Calculate distance using Haversine formula
  const distance = calculateDistance(
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
  if (distance > 5) {
    const extraFee = Math.ceil((distance - 5) * 5);
    deliveryFee += extraFee;
  }

  // Calculate estimated time
  const avgSpeed = 30; // km/h
  const travelTime = (distance / avgSpeed) * 60;
  const estimatedTime = Math.ceil(restaurant.deliverySettings.estimatedDeliveryTime + travelTime);

  return {
    isDeliverable: true,
    distance: distance.toFixed(1),
    deliveryFee,
    estimatedTime,
  };
}

/**
 * Calculate distance using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get user's order statistics
 */
async function getOrderStats(userId) {
  const stats = await Order.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' },
        completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
      },
    },
  ]);

  return stats[0] || {
    totalOrders: 0,
    totalSpent: 0,
    averageOrderValue: 0,
    completedOrders: 0,
    cancelledOrders: 0,
  };
}

/**
 * Get today's restaurant statistics
 */
async function getTodayRestaurantStats(restaurantId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const stats = await Order.aggregate([
    {
      $match: {
        restaurantId,
        createdAt: { $gte: today, $lt: tomorrow },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        pendingOrders: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        preparingOrders: { $sum: { $cond: [{ $eq: ['$status', 'preparing'] }, 1, 0] } },
        completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
      },
    },
  ]);

  return stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    completedOrders: 0,
  };
}

/**
 * Update restaurant rating
 */
async function updateRestaurantRating(restaurantId) {
  const result = await Order.aggregate([
    { $match: { restaurantId, 'rating.overallRating': { $exists: true } } },
    {
      $group: {
        _id: '$restaurantId',
        averageRating: { $avg: '$rating.overallRating' },
        totalRatings: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    await Restaurant.findByIdAndUpdate(restaurantId, {
      averageRating: Math.round(result[0].averageRating * 10) / 10,
      totalReviews: result[0].totalRatings,
    });
  }
}

module.exports = {
  setWebSocketController,
  createOrder,
  getOrderById,
  getMyOrders,
  getRestaurantOrders,
  updateOrderStatus,
  assignDeliveryPartner,
  updateDeliveryLocation,
  cancelOrder,
  trackOrder,
  rateOrder,
  getOrderAnalytics,
};