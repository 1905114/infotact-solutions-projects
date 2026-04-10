const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const { asyncHandler } = require('../middleware/errorMiddleware');

/**
 * @desc    Get merchant dashboard overview
 * @route   GET /api/merchant/dashboard
 * @access  Private (Restaurant Owner)
 */
const getDashboardOverview = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
  
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get today's orders
  const todayOrders = await Order.find({
    restaurantId: restaurant._id,
    createdAt: { $gte: today, $lt: tomorrow },
  });

  // Get pending orders (for real-time acceptance)
  const pendingOrders = await Order.find({
    restaurantId: restaurant._id,
    status: 'pending',
  }).populate('userId', 'firstName lastName address');

  // Calculate today's revenue
  const todayRevenue = todayOrders
    .filter(o => o.paymentStatus === 'completed')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  // Get active orders count
  const activeOrders = await Order.countDocuments({
    restaurantId: restaurant._id,
    status: { $in: ['confirmed', 'preparing', 'ready', 'out-for-delivery'] },
  });

  // Get menu statistics
  const totalMenuItems = await MenuItem.countDocuments({ restaurantId: restaurant._id });
  const availableItems = await MenuItem.countDocuments({ 
    restaurantId: restaurant._id, 
    isAvailable: true 
  });

  // Get recent order activity (last 24 hours)
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentOrders = await Order.find({
    restaurantId: restaurant._id,
    createdAt: { $gte: last24Hours },
  }).sort({ createdAt: -1 }).limit(10);

  // Get hourly order distribution for today
  const hourlyDistribution = await getHourlyDistribution(restaurant._id, today);

  res.status(200).json({
    success: true,
    data: {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        isOpen: restaurant.isOpen,
        isActive: restaurant.isActive,
        totalOrders: restaurant.totalOrders || 0,
        averageRating: restaurant.averageRating,
      },
      stats: {
        todayRevenue,
        todayOrdersCount: todayOrders.length,
        activeOrders,
        pendingOrdersCount: pendingOrders.length,
        totalMenuItems,
        availableItems,
        unavailableItems: totalMenuItems - availableItems,
      },
      pendingOrders,
      recentOrders,
      hourlyDistribution,
    },
  });
});

/**
 * @desc    Toggle restaurant open/closed status
 * @route   PATCH /api/merchant/status
 * @access  Private (Restaurant Owner)
 */
const toggleRestaurantStatus = asyncHandler(async (req, res) => {
  const { isOpen } = req.body;
  
  const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
  
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  restaurant.isOpen = isOpen;
  await restaurant.save();

  // Broadcast status update via WebSocket
  const wsController = req.app.get('wsController');
  if (wsController) {
    wsController.broadcastToAll({
      type: 'RESTAURANT_STATUS_UPDATE',
      restaurantId: restaurant._id,
      isOpen: restaurant.isOpen,
      timestamp: new Date().toISOString(),
    });
  }

  res.status(200).json({
    success: true,
    message: `Restaurant is now ${isOpen ? 'open' : 'closed'}`,
    data: { isOpen: restaurant.isOpen },
  });
});

/**
 * @desc    Toggle menu item availability
 * @route   PATCH /api/merchant/menu/:itemId
 * @access  Private (Restaurant Owner)
 */
const toggleMenuItemAvailability = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { isAvailable } = req.body;

  const menuItem = await MenuItem.findById(itemId).populate('restaurantId');
  
  if (!menuItem) {
    return res.status(404).json({
      success: false,
      message: 'Menu item not found',
    });
  }

  // Check ownership
  if (menuItem.restaurantId.ownerId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  menuItem.isAvailable = isAvailable;
  await menuItem.save();

  // Broadcast menu update via WebSocket
  const wsController = req.app.get('wsController');
  if (wsController) {
    wsController.broadcastToAll({
      type: 'MENU_ITEM_UPDATE',
      restaurantId: menuItem.restaurantId._id,
      itemId: menuItem._id,
      name: menuItem.name,
      isAvailable: menuItem.isAvailable,
      timestamp: new Date().toISOString(),
    });
  }

  res.status(200).json({
    success: true,
    message: `Menu item is now ${isAvailable ? 'available' : 'unavailable'}`,
    data: menuItem,
  });
});

/**
 * @desc    Bulk update menu items availability
 * @route   POST /api/merchant/menu/bulk-update
 * @access  Private (Restaurant Owner)
 */
const bulkUpdateMenuItems = asyncHandler(async (req, res) => {
  const { items } = req.body;

  const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  const results = [];
  for (const item of items) {
    const menuItem = await MenuItem.findOne({
      _id: item.itemId,
      restaurantId: restaurant._id,
    });
    
    if (menuItem) {
      menuItem.isAvailable = item.isAvailable;
      await menuItem.save();
      results.push({
        itemId: menuItem._id,
        name: menuItem.name,
        isAvailable: menuItem.isAvailable,
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `Updated ${results.length} menu items`,
    data: results,
  });
});

/**
 * @desc    Get daily revenue aggregates
 * @route   GET /api/merchant/revenue
 * @access  Private (Restaurant Owner)
 */
const getRevenueAggregates = asyncHandler(async (req, res) => {
  const { period = 'week', startDate, endDate } = req.query;
  
  const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  let dateFilter = {};
  const now = new Date();

  if (startDate && endDate) {
    dateFilter = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };
  } else {
    switch (period) {
      case 'day':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dateFilter = { createdAt: { $gte: today } };
        break;
      case 'week':
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        dateFilter = { createdAt: { $gte: weekAgo } };
        break;
      case 'month':
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        dateFilter = { createdAt: { $gte: monthAgo } };
        break;
      case 'year':
        const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
        dateFilter = { createdAt: { $gte: yearAgo } };
        break;
    }
  }

  const revenueData = await Order.aggregate([
    {
      $match: {
        restaurantId: restaurant._id,
        paymentStatus: 'completed',
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        },
        dailyRevenue: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
        averageOrderValue: { $avg: '$totalAmount' },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  const totals = await Order.aggregate([
    {
      $match: {
        restaurantId: restaurant._id,
        paymentStatus: 'completed',
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: '$totalAmount' },
        totalDeliveryFees: { $sum: '$deliveryFee' },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      period,
      revenueData,
      summary: totals[0] || {
        totalRevenue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        totalDeliveryFees: 0,
      },
    },
  });
});

/**
 * @desc    Get pending orders for acceptance
 * @route   GET /api/merchant/orders/pending
 * @access  Private (Restaurant Owner)
 */
const getPendingOrders = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
  
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  const pendingOrders = await Order.find({
    restaurantId: restaurant._id,
    status: 'pending',
  })
    .populate('userId', 'firstName lastName phoneNumber address')
    .sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    count: pendingOrders.length,
    data: pendingOrders,
  });
});

/**
 * @desc    Accept order
 * @route   POST /api/merchant/orders/:orderId/accept
 * @access  Private (Restaurant Owner)
 */
const acceptOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { estimatedPreparationTime } = req.body;

  const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  const order = await Order.findOne({
    _id: orderId,
    restaurantId: restaurant._id,
    status: 'pending',
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found or already processed',
    });
  }

  order.status = 'confirmed';
  order.confirmedAt = new Date();
  order.estimatedDeliveryTime = estimatedPreparationTime || 30;
  order.statusHistory.push({
    status: 'confirmed',
    timestamp: new Date(),
    note: 'Order accepted by restaurant',
    updatedBy: req.user.id,
  });

  await order.save();

  const wsController = req.app.get('wsController');
  if (wsController) {
    wsController.broadcastOrderStatus(order._id, 'confirmed', {
      orderNumber: order.orderNumber,
      estimatedTime: order.estimatedDeliveryTime,
      timestamp: new Date().toISOString(),
    });
    
    wsController.sendNotification(
      order.userId,
      'Order Accepted',
      `Your order #${order.orderNumber} has been accepted by ${restaurant.name}`,
      'success',
      { orderId: order._id }
    );
  }

  res.status(200).json({
    success: true,
    message: 'Order accepted successfully',
    data: order,
  });
});

/**
 * @desc    Reject order
 * @route   POST /api/merchant/orders/:orderId/reject
 * @access  Private (Restaurant Owner)
 */
const rejectOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  const order = await Order.findOne({
    _id: orderId,
    restaurantId: restaurant._id,
    status: 'pending',
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found or already processed',
    });
  }

  order.status = 'cancelled';
  order.cancellationReason = reason || 'Order rejected by restaurant';
  order.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    note: `Order rejected: ${reason || 'No reason provided'}`,
    updatedBy: req.user.id,
  });

  await order.save();

  const wsController = req.app.get('wsController');
  if (wsController) {
    wsController.broadcastOrderStatus(order._id, 'cancelled', {
      orderNumber: order.orderNumber,
      reason: order.cancellationReason,
      timestamp: new Date().toISOString(),
    });
    
    wsController.sendNotification(
      order.userId,
      'Order Rejected',
      `Your order #${order.orderNumber} has been rejected by ${restaurant.name}. Reason: ${reason || 'Not specified'}`,
      'error',
      { orderId: order._id }
    );
  }

  res.status(200).json({
    success: true,
    message: 'Order rejected',
    data: order,
  });
});

/**
 * @desc    Update order preparation status
 * @route   PATCH /api/merchant/orders/:orderId/prepare
 * @access  Private (Restaurant Owner)
 */
const updateOrderPreparation = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body; // 'preparing', 'ready'

  const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  const order = await Order.findOne({
    _id: orderId,
    restaurantId: restaurant._id,
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  if (order.status !== 'confirmed' && status === 'preparing') {
    return res.status(400).json({
      success: false,
      message: 'Order must be confirmed before preparing',
    });
  }

  if (order.status !== 'preparing' && status === 'ready') {
    return res.status(400).json({
      success: false,
      message: 'Order must be preparing before ready',
    });
  }

  order.status = status;
  if (status === 'preparing') order.preparationStartedAt = new Date();
  if (status === 'ready') order.readyAt = new Date();
  
  order.statusHistory.push({
    status,
    timestamp: new Date(),
    note: `Order is now ${status}`,
    updatedBy: req.user.id,
  });

  await order.save();

  const wsController = req.app.get('wsController');
  if (wsController) {
    wsController.broadcastOrderStatus(order._id, status, {
      orderNumber: order.orderNumber,
      timestamp: new Date().toISOString(),
    });
    
    const statusMessages = {
      preparing: 'Your order is now being prepared',
      ready: 'Your order is ready for pickup/delivery',
    };
    
    wsController.sendNotification(
      order.userId,
      `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      statusMessages[status],
      'info',
      { orderId: order._id }
    );
  }

  res.status(200).json({
    success: true,
    message: `Order is now ${status}`,
    data: order,
  });
});

/**
 * @desc    Get menu items with availability
 * @route   GET /api/merchant/menu
 * @access  Private (Restaurant Owner)
 */
const getMerchantMenu = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
  
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  const menuItems = await MenuItem.find({ restaurantId: restaurant._id })
    .sort({ category: 1, name: 1 });

  // Group by category
  const groupedMenu = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  res.status(200).json({
    success: true,
    data: {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        isOpen: restaurant.isOpen,
      },
      categories: Object.keys(groupedMenu),
      menu: groupedMenu,
      stats: {
        total: menuItems.length,
        available: menuItems.filter(i => i.isAvailable).length,
        unavailable: menuItems.filter(i => !i.isAvailable).length,
      },
    },
  });
});

/**
 * @desc    Get order analytics for merchant
 * @route   GET /api/merchant/analytics
 * @access  Private (Restaurant Owner)
 */
const getMerchantAnalytics = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const analytics = await Order.aggregate([
    {
      $match: {
        restaurantId: restaurant._id,
        createdAt: { $gte: startDate },
      },
    },
    {
      $facet: {
        totalStats: [
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' },
              avgOrderValue: { $avg: '$totalAmount' },
              completedOrders: {
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
              },
              cancelledOrders: {
                $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
              },
            },
          },
        ],
        statusBreakdown: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ],
        dailyTrend: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              orders: { $sum: 1 },
              revenue: { $sum: '$totalAmount' },
            },
          },
          { $sort: { _id: 1 } },
        ],
        popularItems: [
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.name',
              totalQuantity: { $sum: '$items.quantity' },
              totalRevenue: { $sum: '$items.totalPrice' },
            },
          },
          { $sort: { totalQuantity: -1 } },
          { $limit: 10 },
        ],
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      period: `${days} days`,
      stats: analytics[0].totalStats[0] || {},
      statusBreakdown: analytics[0].statusBreakdown,
      dailyTrend: analytics[0].dailyTrend,
      popularItems: analytics[0].popularItems,
    },
  });
});

// Helper function to get hourly distribution
async function getHourlyDistribution(restaurantId, date) {
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);

  const distribution = await Order.aggregate([
    {
      $match: {
        restaurantId,
        createdAt: { $gte: date, $lt: endDate },
      },
    },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const hourlyData = Array(24).fill(0);
  distribution.forEach(d => {
    if (d._id >= 0 && d._id < 24) {
      hourlyData[d._id] = d.count;
    }
  });

  return hourlyData;
}

module.exports = {
  getDashboardOverview,
  toggleRestaurantStatus,
  toggleMenuItemAvailability,
  bulkUpdateMenuItems,
  getRevenueAggregates,
  getPendingOrders,
  acceptOrder,
  rejectOrder,
  updateOrderPreparation,
  getMerchantMenu,
  getMerchantAnalytics,
};