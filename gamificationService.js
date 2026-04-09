/**
 * Gamification Service - Calculates points for reviews based on quality metrics
 */

const Review = require('../models/Review');
const UserReward = require('../models/UserReward');
const Order = require('../models/Order');

class GamificationService {
  constructor() {
    this.pointConfig = {
      basePoints: 10,
      wordCountThresholds: [
        { minWords: 50, points: 5 },
        { minWords: 100, points: 10 },
        { minWords: 200, points: 20 },
        { minWords: 500, points: 50 },
      ],
      keywordPoints: {
        perKeyword: 2,
        maxKeywordsBonus: 20,
      },
      mediaPoints: {
        perImage: 5,
        maxMediaBonus: 25,
        videoBonus: 15,
      },
      ratingBonus: {
        5: 10,
        4: 5,
        3: 0,
        2: -5,
        1: -10,
      },
      helpfulBonus: {
        perHelpful: 1,
        milestoneBonuses: [
          { helpfulCount: 10, bonus: 25 },
          { helpfulCount: 50, bonus: 100 },
          { helpfulCount: 100, bonus: 250 },
          { helpfulCount: 500, bonus: 500 },
        ],
      },
      verifiedPurchaseBonus: 15,
    };
  }

  /**
   * Calculate points for a review
   */
  async calculateReviewPoints(reviewData) {
    const { content, images = [], rating, orderId, userId, restaurantId } = reviewData;

    const pointsBreakdown = {
      basePoints: this.pointConfig.basePoints,
      wordCountBonus: 0,
      keywordBonus: 0,
      mediaBonus: 0,
      ratingBonus: 0,
      helpfulBonus: 0,
      verifiedPurchaseBonus: 0,
    };

    // 1. Word count analysis
    const wordCount = this.calculateWordCount(content);
    pointsBreakdown.wordCountBonus = this.calculateWordCountBonus(wordCount);

    // 2. Keyword density analysis
    const keywordAnalysis = this.analyzeKeywords(content);
    pointsBreakdown.keywordBonus = this.calculateKeywordBonus(keywordAnalysis);

    // 3. Media bonus
    pointsBreakdown.mediaBonus = this.calculateMediaBonus(images);

    // 4. Rating bonus/penalty
    pointsBreakdown.ratingBonus = this.calculateRatingBonus(rating);

    // 5. Verified purchase bonus
    let isVerifiedPurchase = false;
    if (orderId) {
      const order = await Order.findById(orderId);
      isVerifiedPurchase = order && order.userId.toString() === userId && 
        order.restaurantId.toString() === restaurantId;
      
      if (isVerifiedPurchase) {
        pointsBreakdown.verifiedPurchaseBonus = this.pointConfig.verifiedPurchaseBonus;
      }
    }

    const totalPoints = Object.values(pointsBreakdown).reduce((sum, val) => sum + val, 0);

    return {
      totalPoints: Math.max(0, totalPoints),
      pointsBreakdown,
      isVerifiedPurchase,
      keywordAnalysis,
      wordCount,
    };
  }

  /**
   * Calculate word count from content
   */
  calculateWordCount(content) {
    if (!content) return 0;
    return content.trim().split(/\s+/).length;
  }

  /**
   * Calculate bonus based on word count
   */
  calculateWordCountBonus(wordCount) {
    let bonus = 0;
    for (const threshold of this.pointConfig.wordCountThresholds) {
      if (wordCount >= threshold.minWords) {
        bonus = Math.max(bonus, threshold.points);
      }
    }
    return bonus;
  }

  /**
   * Analyze keywords in review content
   */
  analyzeKeywords(content) {
    const keywords = {
      foodRelated: [
        'delicious', 'tasty', 'flavor', 'spicy', 'fresh', 'authentic',
        'savory', 'sweet', 'juicy', 'crispy', 'creamy', 'rich',
      ],
      serviceRelated: [
        'service', 'friendly', 'attentive', 'quick', 'professional',
        'courteous', 'helpful', 'efficient', 'prompt',
      ],
      ambienceRelated: [
        'ambience', 'atmosphere', 'decor', 'clean', 'comfortable',
        'spacious', 'cozy', 'vibe', 'music',
      ],
      valueRelated: [
        'value', 'price', 'worth', 'affordable', 'expensive',
        'reasonable', 'budget', 'cost', 'money',
      ],
    };

    const lowerContent = content.toLowerCase();
    const foundKeywords = [];

    for (const [category, words] of Object.entries(keywords)) {
      for (const word of words) {
        if (lowerContent.includes(word)) {
          foundKeywords.push({ word, category });
        }
      }
    }

    const uniqueKeywords = [...new Map(foundKeywords.map(k => [k.word, k])).values()];

    return {
      totalKeywords: uniqueKeywords.length,
      keywordDensity: uniqueKeywords.length / this.calculateWordCount(content),
      uniqueKeywords,
      categories: {
        food: uniqueKeywords.filter(k => k.category === 'foodRelated').length,
        service: uniqueKeywords.filter(k => k.category === 'serviceRelated').length,
        ambience: uniqueKeywords.filter(k => k.category === 'ambienceRelated').length,
        value: uniqueKeywords.filter(k => k.category === 'valueRelated').length,
      },
    };
  }

  /**
   * Calculate keyword bonus
   */
  calculateKeywordBonus(keywordAnalysis) {
    const keywordCount = keywordAnalysis.totalKeywords;
    const bonus = Math.min(
      keywordCount * this.pointConfig.keywordPoints.perKeyword,
      this.pointConfig.keywordPoints.maxKeywordsBonus
    );
    return bonus;
  }

  /**
   * Calculate media bonus for images and videos
   */
  calculateMediaBonus(images) {
    const imageCount = images?.length || 0;
    return Math.min(
      imageCount * this.pointConfig.mediaPoints.perImage,
      this.pointConfig.mediaPoints.maxMediaBonus
    );
  }

  /**
   * Calculate rating bonus
   */
  calculateRatingBonus(rating) {
    return this.pointConfig.ratingBonus[rating] || 0;
  }

  /**
   * Award points to user and update level
   */
  async awardPoints(userId, points, reason, source, sourceId) {
    let userReward = await UserReward.findOne({ userId });
    
    if (!userReward) {
      userReward = await UserReward.create({
        userId,
        totalPoints: 0,
        reviewCount: 0,
      });
    }

    userReward.totalPoints += points;
    userReward.pointsHistory.push({
      points,
      reason,
      source,
      sourceId,
      awardedAt: new Date(),
    });

    userReward.updateLevel();
    await userReward.save();

    // Check for achievements
    const newAchievements = await this.checkAndAwardAchievements(userId, userReward);

    return {
      totalPoints: userReward.totalPoints,
      level: userReward.level,
      newAchievements,
    };
  }

  /**
   * Check and award achievements
   */
  async checkAndAwardAchievements(userId, userReward) {
    const achievements = [];
    const newAchievements = [];

    // Review count achievements
    if (userReward.reviewCount >= 1 && !this.hasAchievement(userReward, 'first_review')) {
      achievements.push({
        achievementId: 'first_review',
        name: 'First Review',
        description: 'Wrote your first review',
        badge: '🎖️',
        points: 25,
      });
    }

    if (userReward.reviewCount >= 10 && !this.hasAchievement(userReward, 'review_expert')) {
      achievements.push({
        achievementId: 'review_expert',
        name: 'Review Expert',
        description: 'Wrote 10 reviews',
        badge: '🏆',
        points: 100,
      });
    }

    if (userReward.reviewCount >= 50 && !this.hasAchievement(userReward, 'review_master')) {
      achievements.push({
        achievementId: 'review_master',
        name: 'Review Master',
        description: 'Wrote 50 reviews',
        badge: '👑',
        points: 500,
      });
    }

    // Points achievements
    if (userReward.totalPoints >= 100 && !this.hasAchievement(userReward, '100_points')) {
      achievements.push({
        achievementId: '100_points',
        name: 'Century Club',
        description: 'Earned 100 points',
        badge: '💯',
        points: 50,
      });
    }

    if (userReward.totalPoints >= 500 && !this.hasAchievement(userReward, '500_points')) {
      achievements.push({
        achievementId: '500_points',
        name: 'Point Collector',
        description: 'Earned 500 points',
        badge: '💰',
        points: 100,
      });
    }

    if (userReward.totalPoints >= 1000 && !this.hasAchievement(userReward, '1000_points')) {
      achievements.push({
        achievementId: '1000_points',
        name: 'Points Master',
        description: 'Earned 1000 points',
        badge: '💎',
        points: 200,
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
      
      // Award bonus points
      userReward.totalPoints += achievement.points;
      userReward.pointsHistory.push({
        points: achievement.points,
        reason: `Achievement unlocked: ${achievement.name} (+${achievement.points} points)`,
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
  hasAchievement(userReward, achievementId) {
    return userReward.achievements.some(a => a.achievementId === achievementId);
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit = 10) {
    const leaderboard = await UserReward.find()
      .sort({ totalPoints: -1 })
      .limit(limit)
      .populate('userId', 'firstName lastName profilePicture');

    return leaderboard.map(entry => ({
      rank: 0, // Will be set after
      user: {
        id: entry.userId._id,
        name: `${entry.userId.firstName} ${entry.userId.lastName}`,
        profilePicture: entry.userId.profilePicture,
      },
      totalPoints: entry.totalPoints,
      level: entry.level,
      reviewCount: entry.reviewCount,
      helpfulReviews: entry.helpfulReviews,
      badges: entry.badges.length,
    }));
  }
}

module.exports = new GamificationService();