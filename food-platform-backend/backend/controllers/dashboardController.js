const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const Review = require('../models/Review');
const Transaction = require('../models/Transaction');
const { asyncHandler } = require('../middleware/errorMiddleware');

/**
 * @desc    Get admin dashboard metrics
 * @route   GET /api/admin/dashboard
 * @access  Private/Admin
 */
const getAdminDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Parallel queries for performance
  const [
    totalUsers,
    totalRestaurants,
    totalOrders,
    totalRevenue,
    todayOrders,
    todayRevenue,
    pendingRestaurants,
    activeUsers,
    recentOrders,
    topRestaurants,
  ] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Restaurant.countDocuments({ isActive: true }),
    Order.countDocuments(),
    Order.aggregate([{ $match: { paymentStatus: 'completed' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
    Order.aggregate([{ $match: { paymentStatus: 'completed', createdAt: { $gte: today, $lt: tomorrow } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Restaurant.countDocuments({ isVerified: false, isActive: true }),
    User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    Order.find().sort({ createdAt: -1 }).limit(10).populate('userId', 'firstName lastName').populate('restaurantId', 'name'),
    Order.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: '$restaurantId', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'restaurants', localField: '_id', foreignField: '_id', as: 'restaurant' } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      metrics: {
        totalUsers,
        totalRestaurants,
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        todayOrders,
        todayRevenue: todayRevenue[0]?.total || 0,
        pendingRestaurants,
        activeUsers,
      },
      recentOrders,
      topRestaurants: topRestaurants.map(r => ({
        name: r.restaurant[0]?.name || 'Unknown',
        revenue: r.revenue,
        orders: r.orders,
      })),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * @desc    Get platform-wide analytics
 * @route   GET /api/admin/analytics
 * @access  Private/Admin
 */
const getPlatformAnalytics = asyncHandler(async (req, res) => {
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

  const [
    orderTrend,
    userGrowth,
    revenueByCategory,
    averageRatingTrend,
  ] = await Promise.all([
    Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          newUsers: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'completed', ...dateFilter } },
      { $lookup: { from: 'restaurants', localField: 'restaurantId', foreignField: '_id', as: 'restaurant' } },
      { $unwind: '$restaurant' },
      {
        $group: {
          _id: '$restaurant.cuisineTypes',
          revenue: { $sum: '$totalAmount' },
        },
      },
    ]),
    Review.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          avgRating: { $avg: '$rating' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      period,
      orderTrend,
      userGrowth,
      revenueByCategory,
      averageRatingTrend,
    },
  });
});

/**
 * @desc    Get system health metrics
 * @route   GET /api/admin/health
 * @access  Private/Admin
 */
const getSystemHealth = asyncHandler(async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState];

  const metrics = {
    database: {
      status: dbStatus,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(200).json({
    success: true,
    data: metrics,
  });
});

module.exports = {
  getAdminDashboard,
  getPlatformAnalytics,
  getSystemHealth,
};