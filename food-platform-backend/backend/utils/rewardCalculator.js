/**
 * Reward Calculator - Calculates points and rewards for user actions
 */

class RewardCalculator {
  constructor() {
    this.pointConfig = {
      review: {
        base: 10,
        wordCount: {
          thresholds: [
            { min: 50, points: 5 },
            { min: 100, points: 10 },
            { min: 200, points: 20 },
            { min: 500, points: 50 },
          ],
        },
        keyword: {
          perKeyword: 2,
          maxBonus: 20,
        },
        media: {
          perImage: 5,
          maxBonus: 25,
          videoBonus: 15,
        },
        rating: {
          5: 10,
          4: 5,
          3: 0,
          2: -5,
          1: -10,
        },
        verifiedPurchase: 15,
        helpfulVote: 1,
        helpfulMilestones: [
          { count: 10, bonus: 25 },
          { count: 50, bonus: 100 },
          { count: 100, bonus: 250 },
          { count: 500, bonus: 500 },
        ],
      },
      order: {
        firstOrder: 50,
        milestoneOrders: [
          { count: 10, bonus: 100 },
          { count: 25, bonus: 250 },
          { count: 50, bonus: 500 },
          { count: 100, bonus: 1000 },
        ],
        streak: {
          perDay: 5,
          milestoneDays: [
            { days: 7, bonus: 50 },
            { days: 30, bonus: 200 },
            { days: 100, bonus: 500 },
            { days: 365, bonus: 2000 },
          ],
        },
      },
      referral: {
        perReferral: 100,
        milestoneReferrals: [
          { count: 5, bonus: 250 },
          { count: 10, bonus: 500 },
          { count: 25, bonus: 1500 },
          { count: 50, bonus: 5000 },
        ],
      },
      achievement: {
        reviewMaster: 500,
        helpfulReviewer: 250,
        topReviewer: 1000,
        loyalCustomer: 200,
      },
    };
  }

  /**
   * Calculate review points
   */
  calculateReviewPoints(reviewData) {
    const { content, images = [], rating, isVerifiedPurchase = false } = reviewData;
    
    const breakdown = {
      basePoints: this.pointConfig.review.base,
      wordCountBonus: 0,
      keywordBonus: 0,
      mediaBonus: 0,
      ratingBonus: 0,
      verifiedPurchaseBonus: 0,
    };
    
    // Word count bonus
    const wordCount = this.getWordCount(content);
    breakdown.wordCountBonus = this.calculateWordCountBonus(wordCount);
    
    // Keyword bonus
    const keywordCount = this.countKeywords(content);
    breakdown.keywordBonus = Math.min(
      keywordCount * this.pointConfig.review.keyword.perKeyword,
      this.pointConfig.review.keyword.maxBonus
    );
    
    // Media bonus
    breakdown.mediaBonus = this.calculateMediaBonus(images);
    
    // Rating bonus
    breakdown.ratingBonus = this.pointConfig.review.rating[rating] || 0;
    
    // Verified purchase bonus
    if (isVerifiedPurchase) {
      breakdown.verifiedPurchaseBonus = this.pointConfig.review.verifiedPurchase;
    }
    
    const totalPoints = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    
    return {
      total: Math.max(0, totalPoints),
      breakdown,
      metadata: {
        wordCount,
        keywordCount,
        imageCount: images?.length || 0,
        rating,
        isVerifiedPurchase,
      },
    };
  }

  /**
   * Calculate word count bonus
   */
  calculateWordCountBonus(wordCount) {
    let bonus = 0;
    for (const threshold of this.pointConfig.review.wordCount.thresholds) {
      if (wordCount >= threshold.min) {
        bonus = Math.max(bonus, threshold.points);
      }
    }
    return bonus;
  }

  /**
   * Calculate media bonus
   */
  calculateMediaBonus(images) {
    const imageCount = images?.length || 0;
    return Math.min(
      imageCount * this.pointConfig.review.media.perImage,
      this.pointConfig.review.media.maxBonus
    );
  }

  /**
   * Count keywords in content
   */
  countKeywords(content) {
    const keywords = [
      'delicious', 'tasty', 'flavor', 'fresh', 'authentic', 'quality',
      'service', 'friendly', 'attentive', 'quick', 'professional',
      'ambience', 'atmosphere', 'clean', 'comfortable', 'value',
      'price', 'worth', 'recommend', 'experience', 'portion',
    ];
    
    const lowerContent = content.toLowerCase();
    let count = 0;
    
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Get word count
   */
  getWordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  /**
   * Calculate order milestone bonus
   */
  calculateOrderMilestoneBonus(orderCount) {
    let bonus = 0;
    let milestone = null;
    
    for (const m of this.pointConfig.order.milestoneOrders) {
      if (orderCount === m.count) {
        bonus = m.bonus;
        milestone = m;
        break;
      }
    }
    
    return { bonus, milestone };
  }

  /**
   * Calculate streak bonus
   */
  calculateStreakBonus(streakDays) {
    let bonus = 0;
    let milestone = null;
    
    for (const m of this.pointConfig.order.streak.milestoneDays) {
      if (streakDays === m.days) {
        bonus = m.bonus;
        milestone = m;
        break;
      }
    }
    
    return { bonus, milestone };
  }

  /**
   * Calculate helpful vote milestone bonus
   */
  calculateHelpfulMilestoneBonus(helpfulCount) {
    let bonus = 0;
    let milestone = null;
    
    for (const m of this.pointConfig.review.helpfulMilestones) {
      if (helpfulCount === m.count) {
        bonus = m.bonus;
        milestone = m;
        break;
      }
    }
    
    return { bonus, milestone };
  }

  /**
   * Calculate referral bonus
   */
  calculateReferralBonus(referralCount) {
    let bonus = 0;
    let milestone = null;
    
    for (const m of this.pointConfig.referral.milestoneReferrals) {
      if (referralCount === m.count) {
        bonus = m.bonus;
        milestone = m;
        break;
      }
    }
    
    return { bonus, milestone };
  }

  /**
   * Calculate level from points
   */
  calculateLevel(points) {
    let level = 1;
    let pointsForNextLevel = 100;
    
    while (points >= pointsForNextLevel) {
      level++;
      pointsForNextLevel = Math.floor(100 * Math.pow(1.2, level - 1));
    }
    
    const currentLevelPoints = points - this.getLevelThreshold(level);
    const nextLevelPoints = this.getLevelThreshold(level + 1) - this.getLevelThreshold(level);
    const progress = (currentLevelPoints / nextLevelPoints) * 100;
    
    return {
      level,
      progress: Math.min(100, Math.max(0, progress)),
      pointsForNextLevel: nextLevelPoints,
      currentLevelPoints,
    };
  }

  /**
   * Get level threshold
   */
  getLevelThreshold(level) {
    if (level === 1) return 0;
    let threshold = 0;
    for (let i = 1; i < level; i++) {
      threshold += Math.floor(100 * Math.pow(1.2, i - 1));
    }
    return threshold;
  }

  /**
   * Calculate tier from points
   */
  calculateTier(points) {
    const tiers = [
      { name: 'bronze', threshold: 0, badge: '🥉', color: '#CD7F32' },
      { name: 'silver', threshold: 500, badge: '🥈', color: '#C0C0C0' },
      { name: 'gold', threshold: 1500, badge: '🥇', color: '#FFD700' },
      { name: 'platinum', threshold: 3500, badge: '💎', color: '#E5E4E2' },
      { name: 'diamond', threshold: 7000, badge: '👑', color: '#B9F2FF' },
    ];
    
    let currentTier = tiers[0];
    let nextTier = tiers[1];
    
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (points >= tiers[i].threshold) {
        currentTier = tiers[i];
        nextTier = tiers[i + 1] || null;
        break;
      }
    }
    
    const pointsToNext = nextTier ? nextTier.threshold - points : 0;
    const progress = nextTier ? ((points - currentTier.threshold) / (nextTier.threshold - currentTier.threshold)) * 100 : 100;
    
    return {
      current: currentTier,
      next: nextTier,
      pointsToNext: Math.max(0, pointsToNext),
      progress: Math.min(100, Math.max(0, progress)),
    };
  }

  /**
   * Calculate achievement points
   */
  calculateAchievementPoints(achievementId) {
    return this.pointConfig.achievement[achievementId] || 0;
  }

  /**
   * Get available rewards for points
   */
  getAvailableRewards(points) {
    const rewards = [
      { id: 'discount_50', name: '₹50 Discount', pointsCost: 500, type: 'discount', value: 50 },
      { id: 'discount_100', name: '₹100 Discount', pointsCost: 900, type: 'discount', value: 100 },
      { id: 'free_delivery', name: 'Free Delivery', pointsCost: 300, type: 'delivery', value: 0 },
      { id: 'discount_200', name: '₹200 Discount', pointsCost: 1700, type: 'discount', value: 200 },
      { id: 'discount_500', name: '₹500 Discount', pointsCost: 4000, type: 'discount', value: 500 },
      { id: 'meal_voucher', name: 'Free Meal (up to ₹300)', pointsCost: 2500, type: 'voucher', value: 300 },
    ];
    
    return rewards.filter(reward => reward.pointsCost <= points);
  }

  /**
   * Calculate points needed for next tier
   */
  getPointsForNextTier(currentPoints) {
    const tier = this.calculateTier(currentPoints);
    return tier.pointsToNext;
  }
}

module.exports = new RewardCalculator();