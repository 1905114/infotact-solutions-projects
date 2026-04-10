const Review = require('../models/Review');
const UserReward = require('../models/UserReward');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const { asyncHandler } = require('../middleware/errorMiddleware');
const gamificationService = require('../services/gamificationService');
const aiSuggestionService = require('../services/aiSuggestionService');

/**
 * @desc    Create a new review with gamification points
 * @route   POST /api/reviews
 * @access  Private
 */
const createReview = asyncHandler(async (req, res) => {
  const {
    restaurantId,
    orderId,
    rating,
    title,
    content,
    images = [],
    tags = [],
  } = req.body;

  // Check if user already reviewed this restaurant
  const existingReview = await Review.findOne({
    userId: req.user.id,
    restaurantId,
  });

  if (existingReview) {
    return res.status(400).json({
      success: false,
      message: 'You have already reviewed this restaurant',
    });
  }

  // Verify user has ordered from this restaurant (if orderId provided)
  let isVerifiedPurchase = false;
  if (orderId) {
    const order = await Order.findOne({
      _id: orderId,
      userId: req.user.id,
      restaurantId,
      status: 'delivered',
    });
    isVerifiedPurchase = !!order;
  }

  // Calculate points using gamification service
  const pointsCalculation = await gamificationService.calculateReviewPoints({
    content,
    images,
    rating,
    orderId: isVerifiedPurchase ? orderId : null,
    userId: req.user.id,
    restaurantId,
  });

  // Create review
  const review = await Review.create({
    userId: req.user.id,
    restaurantId,
    orderId: isVerifiedPurchase ? orderId : null,
    rating,
    title,
    content,
    images,
    tags,
    isVerifiedPurchase,
    pointsAwarded: pointsCalculation.totalPoints,
    pointsBreakdown: pointsCalculation.pointsBreakdown,
    status: 'approved', // Auto-approve, could be pending for moderation
  });

  // Update user rewards
  let userReward = await UserReward.findOne({ userId: req.user.id });
  if (!userReward) {
    userReward = await UserReward.create({
      userId: req.user.id,
      totalPoints: 0,
      reviewCount: 0,
    });
  }

  // Add points to user's total
  userReward.totalPoints += pointsCalculation.totalPoints;
  userReward.reviewCount += 1;
  
  // Add to points history
  userReward.pointsHistory.push({
    points: pointsCalculation.totalPoints,
    reason: `Review for restaurant (${pointsCalculation.totalPoints} points)`,
    source: 'review',
    sourceId: review._id,
    awardedAt: new Date(),
  });

  // Update user level based on new points
  userReward.updateLevel();
  await userReward.save();

  // Update restaurant's average rating
  await updateRestaurantRating(restaurantId);

  // Trigger achievement checks
  await checkAndAwardAchievements(req.user.id, userReward);

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully',
    data: {
      review,
      pointsEarned: pointsCalculation.totalPoints,
      pointsBreakdown: pointsCalculation.pointsBreakdown,
      totalPoints: userReward.totalPoints,
      userLevel: userReward.level,
    },
  });
});

/**
 * @desc    Get AI-powered keyword suggestions for review
 * @route   POST /api/reviews/ai-suggestions
 * @access  Private
 */
const getAISuggestions = asyncHandler(async (req, res) => {
  const { orderId, restaurantId, currentDraft = '' } = req.body;

  // Get user's order history for personalized suggestions
  const userOrders = await Order.find({
    userId: req.user.id,
    status: 'delivered',
  })
    .populate('restaurantId', 'name cuisineTypes')
    .sort({ createdAt: -1 })
    .limit(10);

  // Get specific order details if orderId provided
  let specificOrder = null;
  if (orderId) {
    specificOrder = await Order.findById(orderId)
      .populate('items.menuItemId', 'name category');
  }

  // Get restaurant details
  const restaurant = await Restaurant.findById(restaurantId);

  // Generate AI suggestions
  const suggestions = await aiSuggestionService.generateReviewSuggestions({
    userId: req.user.id,
    restaurant,
    specificOrder,
    userOrders,
    currentDraft,
  });

  res.status(200).json({
    success: true,
    data: suggestions,
  });
});

/**
 * @desc    Get all reviews for a restaurant
 * @route   GET /api/reviews/restaurant/:restaurantId
 * @access  Public
 */
const getRestaurantReviews = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const {
    page = 1,
    limit = 20,
    rating,
    sortBy = 'recent', // recent, helpful, highest, lowest
  } = req.query;

  const filter = {
    restaurantId,
    status: 'approved',
  };

  if (rating) {
    filter.rating = parseInt(rating);
  }

  // Build sort options
  let sortOptions = {};
  switch (sortBy) {
    case 'recent':
      sortOptions = { createdAt: -1 };
      break;
    case 'helpful':
      sortOptions = { helpfulCount: -1, createdAt: -1 };
      break;
    case 'highest':
      sortOptions = { rating: -1, createdAt: -1 };
      break;
    case 'lowest':
      sortOptions = { rating: 1, createdAt: -1 };
      break;
    default:
      sortOptions = { createdAt: -1 };
  }

  const reviews = await Review.find(filter)
    .populate('userId', 'firstName lastName profilePicture')
    .sort(sortOptions)
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Review.countDocuments(filter);

  // Calculate review statistics
  const stats = await getReviewStatistics(restaurantId);

  res.status(200).json({
    success: true,
    count: reviews.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    stats,
    data: reviews,
  });
});

/**
 * @desc    Get user's reviews
 * @route   GET /api/reviews/my-reviews
 * @access  Private
 */
const getMyReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const reviews = await Review.find({ userId: req.user.id })
    .populate('restaurantId', 'name images.logo address.city averageRating')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Review.countDocuments({ userId: req.user.id });

  res.status(200).json({
    success: true,
    count: reviews.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: reviews,
  });
});

/**
 * @desc    Get single review by ID
 * @route   GET /api/reviews/:id
 * @access  Public
 */
const getReviewById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id)
    .populate('userId', 'firstName lastName profilePicture')
    .populate('restaurantId', 'name images.logo address');

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  // Increment view count (optional)
  // review.viewCount = (review.viewCount || 0) + 1;
  // await review.save();

  res.status(200).json({
    success: true,
    data: review,
  });
});

/**
 * @desc    Update review
 * @route   PUT /api/reviews/:id
 * @access  Private (Owner only)
 */
const updateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, title, content, images, tags } = req.body;

  const review = await Review.findById(id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  // Check ownership
  if (review.userId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this review',
    });
  }

  // Save edit history
  if (content !== review.content) {
    review.editHistory.push({
      content: review.content,
      editedAt: new Date(),
    });
    review.isEdited = true;
  }

  // Update fields
  review.rating = rating || review.rating;
  review.title = title || review.title;
  review.content = content || review.content;
  review.images = images || review.images;
  review.tags = tags || review.tags;

  // Recalculate points if content changed
  if (content && content !== review.content) {
    const pointsCalculation = await gamificationService.calculateReviewPoints({
      content: review.content,
      images: review.images,
      rating: review.rating,
      orderId: review.orderId,
      userId: req.user.id,
      restaurantId: review.restaurantId,
    });

    const pointsDifference = pointsCalculation.totalPoints - review.pointsAwarded;
    
    review.pointsAwarded = pointsCalculation.totalPoints;
    review.pointsBreakdown = pointsCalculation.pointsBreakdown;

    // Update user rewards if points changed
    if (pointsDifference !== 0) {
      const userReward = await UserReward.findOne({ userId: req.user.id });
      if (userReward) {
        userReward.totalPoints += pointsDifference;
        userReward.pointsHistory.push({
          points: pointsDifference,
          reason: `Review edit adjustment (${pointsDifference > 0 ? '+' : ''}${pointsDifference} points)`,
          source: 'review',
          sourceId: review._id,
        });
        userReward.updateLevel();
        await userReward.save();
      }
    }
  }

  await review.save();

  // Update restaurant rating if rating changed
  if (rating && rating !== review.rating) {
    await updateRestaurantRating(review.restaurantId);
  }

  res.status(200).json({
    success: true,
    message: 'Review updated successfully',
    data: review,
  });
});

/**
 * @desc    Delete review
 * @route   DELETE /api/reviews/:id
 * @access  Private (Owner or Admin)
 */
const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  // Check authorization
  if (review.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this review',
    });
  }

  // Deduct points from user
  const userReward = await UserReward.findOne({ userId: review.userId });
  if (userReward && review.pointsAwarded > 0) {
    userReward.totalPoints = Math.max(0, userReward.totalPoints - review.pointsAwarded);
    userReward.reviewCount = Math.max(0, userReward.reviewCount - 1);
    userReward.pointsHistory.push({
      points: -review.pointsAwarded,
      reason: `Review deleted (deducted ${review.pointsAwarded} points)`,
      source: 'review',
      sourceId: review._id,
    });
    userReward.updateLevel();
    await userReward.save();
  }

  await review.deleteOne();

  // Update restaurant rating
  await updateRestaurantRating(review.restaurantId);

  res.status(200).json({
    success: true,
    message: 'Review deleted successfully',
  });
});

/**
 * @desc    Mark review as helpful
 * @route   POST /api/reviews/:id/helpful
 * @access  Private
 */
const markHelpful = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  // Check if user already marked as helpful
  const alreadyVoted = review.helpfulVotes.some(
    vote => vote.userId.toString() === req.user.id
  );

  if (!alreadyVoted) {
    review.helpfulCount += 1;
    review.helpfulVotes.push({
      userId: req.user.id,
      votedAt: new Date(),
    });

    // Award bonus points for helpful reviews (milestone-based)
    const helpfulBonus = await checkHelpfulMilestone(review);
    if (helpfulBonus > 0) {
      review.pointsAwarded += helpfulBonus;
      review.pointsBreakdown.helpfulBonus = (review.pointsBreakdown.helpfulBonus || 0) + helpfulBonus;
      
      // Update user rewards
      const userReward = await UserReward.findOne({ userId: review.userId });
      if (userReward) {
        userReward.totalPoints += helpfulBonus;
        userReward.helpfulReviews += 1;
        userReward.pointsHistory.push({
          points: helpfulBonus,
          reason: `Helpful review milestone (${helpfulBonus} points)`,
          source: 'achievement',
          sourceId: review._id,
        });
        userReward.updateLevel();
        await userReward.save();
      }
    }

    await review.save();
  }

  res.status(200).json({
    success: true,
    message: 'Marked as helpful',
    helpfulCount: review.helpfulCount,
  });
});

/**
 * @desc    Get review analytics (admin only)
 * @route   GET /api/reviews/analytics
 * @access  Private/Admin
 */
const getReviewAnalytics = asyncHandler(async (req, res) => {
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

  const analytics = await Review.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        totalPointsAwarded: { $sum: '$pointsAwarded' },
        verifiedPurchaseCount: { $sum: { $cond: ['$isVerifiedPurchase', 1, 0] } },
        helpfulCount: { $sum: '$helpfulCount' },
      },
    },
  ]);

  // Rating distribution
  const ratingDistribution = await Review.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Top reviewers
  const topReviewers = await Review.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$userId',
        reviewCount: { $sum: 1 },
        totalPoints: { $sum: '$pointsAwarded' },
        averageRating: { $avg: '$rating' },
      },
    },
    { $sort: { reviewCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
  ]);

  res.status(200).json({
    success: true,
    period,
    data: analytics[0] || {},
    ratingDistribution,
    topReviewers,
  });
});

/**
 * @desc    Get user's review points and achievements
 * @route   GET /api/reviews/my-stats
 * @access  Private
 */
const getMyReviewStats = asyncHandler(async (req, res) => {
  const userReward = await UserReward.findOne({ userId: req.user.id });

  if (!userReward) {
    return res.status(200).json({
      success: true,
      data: {
        totalPoints: 0,
        reviewCount: 0,
        helpfulReviews: 0,
        level: 1,
        levelProgress: 0,
        achievements: [],
        pointsHistory: [],
      },
    });
  }

  // Get recent reviews
  const recentReviews = await Review.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('restaurantId', 'name');

  res.status(200).json({
    success: true,
    data: {
      totalPoints: userReward.totalPoints,
      reviewCount: userReward.reviewCount,
      helpfulReviews: userReward.helpfulReviews,
      level: userReward.level,
      levelProgress: userReward.levelProgress,
      nextLevelPoints: userReward.nextLevelPoints,
      achievements: userReward.achievements,
      badges: userReward.badges,
      recentReviews,
      pointsHistory: userReward.pointsHistory.slice(-10),
    },
  });
});

/**
 * @desc    Report inappropriate review
 * @route   POST /api/reviews/:id/report
 * @access  Private
 */
const reportReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const review = await Review.findById(id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  // Add to reports (implement reports collection if needed)
  // For now, just flag the review
  review.status = 'flagged';
  review.moderationNotes = `Reported by ${req.user.id}: ${reason}`;
  await review.save();

  // Notify admin (implement notification system)

  res.status(200).json({
    success: true,
    message: 'Review reported successfully',
  });
});

/**
 * @desc    Moderate review (admin only)
 * @route   PUT /api/reviews/:id/moderate
 * @access  Private/Admin
 */
const moderateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const review = await Review.findById(id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  const oldStatus = review.status;
  review.status = status;
  review.moderationNotes = notes;

  // Handle point adjustments based on moderation
  if (oldStatus === 'approved' && status !== 'approved') {
    // Remove points if review is no longer approved
    const userReward = await UserReward.findOne({ userId: review.userId });
    if (userReward && review.pointsAwarded > 0) {
      userReward.totalPoints = Math.max(0, userReward.totalPoints - review.pointsAwarded);
      userReward.pointsHistory.push({
        points: -review.pointsAwarded,
        reason: `Review removed by moderator (deducted ${review.pointsAwarded} points)`,
        source: 'review',
        sourceId: review._id,
      });
      userReward.updateLevel();
      await userReward.save();
    }
  }

  await review.save();

  res.status(200).json({
    success: true,
    message: `Review ${status}`,
    data: review,
  });
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Update restaurant's average rating
 */
async function updateRestaurantRating(restaurantId) {
  const result = await Review.aggregate([
    { $match: { restaurantId, status: 'approved' } },
    {
      $group: {
        _id: '$restaurantId',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    await Restaurant.findByIdAndUpdate(restaurantId, {
      averageRating: Math.round(result[0].averageRating * 10) / 10,
      totalReviews: result[0].totalReviews,
    });
  }
}

/**
 * Get review statistics for a restaurant
 */
async function getReviewStatistics(restaurantId) {
  const stats = await Review.aggregate([
    { $match: { restaurantId, status: 'approved' } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: {},
    };
  }

  const result = stats[0];
  return {
    averageRating: Math.round(result.averageRating * 10) / 10,
    totalReviews: result.totalReviews,
    ratingDistribution: {
      5: result.rating5,
      4: result.rating4,
      3: result.rating3,
      2: result.rating2,
      1: result.rating1,
    },
  };
}

/**
 * Check and award helpful review milestones
 */
async function checkHelpfulMilestone(review) {
  const milestones = [
    { count: 10, bonus: 25 },
    { count: 50, bonus: 100 },
    { count: 100, bonus: 250 },
    { count: 500, bonus: 500 },
  ];

  for (const milestone of milestones) {
    if (review.helpfulCount === milestone.count) {
      return milestone.bonus;
    }
  }
  return 0;
}

/**
 * Check and award achievements
 */
async function checkAndAwardAchievements(userId, userReward) {
  const achievements = [];
  const newAchievements = [];

  // Review count achievements
  if (userReward.reviewCount >= 1 && !hasAchievement(userReward, 'first_review')) {
    achievements.push({
      achievementId: 'first_review',
      name: 'First Review',
      description: 'Wrote your first review',
      badge: '🎖️',
    });
  }

  if (userReward.reviewCount >= 10 && !hasAchievement(userReward, 'review_expert')) {
    achievements.push({
      achievementId: 'review_expert',
      name: 'Review Expert',
      description: 'Wrote 10 reviews',
      badge: '🏆',
    });
  }

  if (userReward.reviewCount >= 50 && !hasAchievement(userReward, 'review_master')) {
    achievements.push({
      achievementId: 'review_master',
      name: 'Review Master',
      description: 'Wrote 50 reviews',
      badge: '👑',
    });
  }

  // Points achievements
  if (userReward.totalPoints >= 100 && !hasAchievement(userReward, '100_points')) {
    achievements.push({
      achievementId: '100_points',
      name: 'Century Club',
      description: 'Earned 100 points',
      badge: '💯',
    });
  }

  if (userReward.totalPoints >= 500 && !hasAchievement(userReward, '500_points')) {
    achievements.push({
      achievementId: '500_points',
      name: 'Point Collector',
      description: 'Earned 500 points',
      badge: '💰',
    });
  }

  if (userReward.totalPoints >= 1000 && !hasAchievement(userReward, '1000_points')) {
    achievements.push({
      achievementId: '1000_points',
      name: 'Points Master',
      description: 'Earned 1000 points',
      badge: '💎',
    });
  }

  // Helpful review achievements
  if (userReward.helpfulReviews >= 5 && !hasAchievement(userReward, 'helpful_5')) {
    achievements.push({
      achievementId: 'helpful_5',
      name: 'Helpful Reviewer',
      description: '5 people found your reviews helpful',
      badge: '👍',
    });
  }

  if (userReward.helpfulReviews >= 25 && !hasAchievement(userReward, 'helpful_25')) {
    achievements.push({
      achievementId: 'helpful_25',
      name: 'Community Star',
      description: '25 people found your reviews helpful',
      badge: '⭐',
    });
  }

  // Award achievements
  for (const achievement of achievements) {
    userReward.achievements.push({
      ...achievement,
      unlockedAt: new Date(),
    });
    userReward.badges.push({
      name: achievement.name,
      icon: achievement.badge,
      earnedAt: new Date(),
    });
    
    // Award bonus points for achievements
    const bonusPoints = 25;
    userReward.totalPoints += bonusPoints;
    userReward.pointsHistory.push({
      points: bonusPoints,
      reason: `Achievement unlocked: ${achievement.name} (+${bonusPoints} points)`,
      source: 'achievement',
    });
    
    newAchievements.push(achievement);
  }

  if (achievements.length > 0) {
    userReward.updateLevel();
    await userReward.save();
  }

  return newAchievements;
}

/**
 * Check if user has a specific achievement
 */
function hasAchievement(userReward, achievementId) {
  return userReward.achievements.some(a => a.achievementId === achievementId);
}

module.exports = {
  createReview,
  getAISuggestions,
  getRestaurantReviews,
  getMyReviews,
  getReviewById,
  updateReview,
  deleteReview,
  markHelpful,
  getReviewAnalytics,
  getMyReviewStats,
  reportReview,
  moderateReview,
};