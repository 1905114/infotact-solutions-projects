const mongoose = require('mongoose');

/**
 * UserReward Schema - Tracks user points, achievements, and gamification progress
 * Supports the review gamification engine and user engagement system
 */
const userRewardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    totalPoints: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    pointsHistory: [
      {
        points: {
          type: Number,
          required: true,
        },
        reason: {
          type: String,
          required: true,
        },
        source: {
          type: String,
          enum: ['review', 'order', 'referral', 'bonus', 'achievement', 'adjustment'],
          required: true,
        },
        sourceId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'sourceModel',
        },
        sourceModel: {
          type: String,
          enum: ['Review', 'Order', 'User'],
        },
        awardedAt: {
          type: Date,
          default: Date.now,
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    achievements: [
      {
        achievementId: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        badge: {
          type: String,
          default: '🏆',
        },
        points: {
          type: Number,
          default: 0,
        },
        unlockedAt: {
          type: Date,
          default: Date.now,
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    level: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
      index: true,
    },
    levelProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    nextLevelPoints: {
      type: Number,
      default: 100,
    },
    currentLevelPoints: {
      type: Number,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    helpfulReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalReviewsWritten: {
      type: Number,
      default: 0,
    },
    totalHelpfulVotes: {
      type: Number,
      default: 0,
    },
    badges: [
      {
        name: {
          type: String,
          required: true,
        },
        icon: {
          type: String,
          default: '🏆',
        },
        description: {
          type: String,
        },
        earnedAt: {
          type: Date,
          default: Date.now,
        },
        category: {
          type: String,
          enum: ['review', 'engagement', 'loyalty', 'special'],
          default: 'review',
        },
      },
    ],
    streak: {
      current: {
        type: Number,
        default: 0,
      },
      longest: {
        type: Number,
        default: 0,
      },
      lastReviewAt: {
        type: Date,
      },
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
      default: 'bronze',
    },
    tierProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    monthlyPoints: {
      type: Number,
      default: 0,
    },
    weeklyPoints: {
      type: Number,
      default: 0,
    },
    lastPointsResetAt: {
      type: Date,
      default: Date.now,
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referralCount: {
      type: Number,
      default: 0,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    redeemedPoints: {
      type: Number,
      default: 0,
    },
    availablePoints: {
      type: Number,
      default: 0,
    },
    redemptionHistory: [
      {
        points: {
          type: Number,
          required: true,
        },
        reward: {
          type: String,
          required: true,
        },
        redeemedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ['pending', 'completed', 'cancelled'],
          default: 'pending',
        },
      },
    ],
    settings: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      pushNotifications: {
        type: Boolean,
        default: true,
      },
      shareAchievements: {
        type: Boolean,
        default: true,
      },
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
userRewardSchema.index({ totalPoints: -1, level: -1 });
userRewardSchema.index({ tier: 1, totalPoints: -1 });
userRewardSchema.index({ referralCode: 1 });
userRewardSchema.index({ 'achievements.achievementId': 1 });
userRewardSchema.index({ lastActiveAt: -1 });

// Tier thresholds
const tierThresholds = {
  bronze: 0,
  silver: 500,
  gold: 1500,
  platinum: 3500,
  diamond: 7000,
};

// Level thresholds (exponential growth)
const getLevelThreshold = (level) => {
  return Math.floor(100 * Math.pow(1.2, level - 1));
};

/**
 * Virtual for formatted total points
 */
userRewardSchema.virtual('formattedTotalPoints').get(function() {
  return this.totalPoints.toLocaleString();
});

/**
 * Virtual for tier name with emoji
 */
userRewardSchema.virtual('tierDisplay').get(function() {
  const tierEmojis = {
    bronze: '🥉 Bronze',
    silver: '🥈 Silver',
    gold: '🥇 Gold',
    platinum: '💎 Platinum',
    diamond: '👑 Diamond',
  };
  return tierEmojis[this.tier] || '🥉 Bronze';
});

/**
 * Virtual for next tier info
 */
userRewardSchema.virtual('nextTier').get(function() {
  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = tiers.indexOf(this.tier);
  if (currentIndex === tiers.length - 1) return null;
  
  const nextTierName = tiers[currentIndex + 1];
  const nextTierThreshold = tierThresholds[nextTierName];
  const pointsToNext = nextTierThreshold - this.totalPoints;
  const progress = ((this.totalPoints - tierThresholds[this.tier]) / 
    (nextTierThreshold - tierThresholds[this.tier])) * 100;
  
  return {
    name: nextTierName,
    threshold: nextTierThreshold,
    pointsNeeded: Math.max(0, pointsToNext),
    progress: Math.min(100, Math.max(0, progress)),
  };
});

/**
 * Update user level based on total points
 */
userRewardSchema.methods.updateLevel = function() {
  let level = 1;
  let pointsRequired = 0;
  
  while (true) {
    const nextThreshold = getLevelThreshold(level + 1);
    if (this.totalPoints >= nextThreshold) {
      level++;
      pointsRequired = nextThreshold;
    } else {
      break;
    }
  }
  
  const nextLevelThreshold = getLevelThreshold(level + 1);
  this.level = level;
  this.currentLevelPoints = this.totalPoints - getLevelThreshold(level);
  this.nextLevelPoints = nextLevelThreshold - getLevelThreshold(level);
  this.levelProgress = (this.currentLevelPoints / this.nextLevelPoints) * 100;
  
  return this.level;
};

/**
 * Update user tier based on total points
 */
userRewardSchema.methods.updateTier = function() {
  let newTier = 'bronze';
  
  if (this.totalPoints >= tierThresholds.diamond) {
    newTier = 'diamond';
  } else if (this.totalPoints >= tierThresholds.platinum) {
    newTier = 'platinum';
  } else if (this.totalPoints >= tierThresholds.gold) {
    newTier = 'gold';
  } else if (this.totalPoints >= tierThresholds.silver) {
    newTier = 'silver';
  }
  
  const oldTier = this.tier;
  this.tier = newTier;
  
  // Calculate tier progress
  const currentTierThreshold = tierThresholds[this.tier];
  const nextTierThreshold = tierThresholds[this.getNextTierName()] || this.totalPoints;
  this.tierProgress = ((this.totalPoints - currentTierThreshold) / 
    (nextTierThreshold - currentTierThreshold)) * 100;
  
  // Award tier achievement if upgraded
  if (oldTier !== newTier && newTier !== 'bronze') {
    this.addAchievement({
      achievementId: `${newTier}_tier`,
      name: `${newTier.charAt(0).toUpperCase() + newTier.slice(1)} Tier`,
      description: `Reached ${newTier} tier status`,
      badge: this.getTierBadge(newTier),
      points: this.getTierBonusPoints(newTier),
    });
  }
  
  return this.tier;
};

/**
 * Get next tier name
 */
userRewardSchema.methods.getNextTierName = function() {
  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = tiers.indexOf(this.tier);
  return tiers[currentIndex + 1];
};

/**
 * Get tier badge emoji
 */
userRewardSchema.methods.getTierBadge = function(tier) {
  const badges = {
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇',
    platinum: '💎',
    diamond: '👑',
  };
  return badges[tier] || '🏆';
};

/**
 * Get tier bonus points
 */
userRewardSchema.methods.getTierBonusPoints = function(tier) {
  const bonuses = {
    silver: 100,
    gold: 250,
    platinum: 500,
    diamond: 1000,
  };
  return bonuses[tier] || 0;
};

/**
 * Add points to user
 */
userRewardSchema.methods.addPoints = async function(points, reason, source, sourceId, metadata = {}) {
  this.totalPoints += points;
  this.availablePoints = this.totalPoints - this.redeemedPoints;
  
  // Update monthly/weekly points
  const now = new Date();
  const lastReset = this.lastPointsResetAt;
  
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.monthlyPoints = 0;
    this.weeklyPoints = 0;
    this.lastPointsResetAt = now;
  }
  
  this.monthlyPoints += points;
  this.weeklyPoints += points;
  
  this.pointsHistory.push({
    points,
    reason,
    source,
    sourceId,
    awardedAt: now,
    metadata,
  });
  
  this.updateLevel();
  this.updateTier();
  this.lastActiveAt = now;
  
  await this.save();
  return this;
};

/**
 * Add achievement to user
 */
userRewardSchema.methods.addAchievement = async function(achievement) {
  const exists = this.achievements.some(a => a.achievementId === achievement.achievementId);
  
  if (!exists) {
    this.achievements.push({
      achievementId: achievement.achievementId,
      name: achievement.name,
      description: achievement.description,
      badge: achievement.badge || '🏆',
      points: achievement.points || 0,
      unlockedAt: new Date(),
      metadata: achievement.metadata || {},
    });
    
    // Award points for achievement
    if (achievement.points > 0) {
      await this.addPoints(
        achievement.points,
        `Achievement unlocked: ${achievement.name}`,
        'achievement',
        null,
        { achievementId: achievement.achievementId }
      );
    }
    
    await this.save();
    return true;
  }
  
  return false;
};

/**
 * Update review streak
 */
userRewardSchema.methods.updateStreak = async function() {
  const now = new Date();
  const lastReview = this.streak.lastReviewAt;
  
  if (!lastReview) {
    this.streak.current = 1;
    this.streak.longest = 1;
  } else {
    const daysSinceLastReview = Math.floor((now - lastReview) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastReview === 1) {
      this.streak.current += 1;
      if (this.streak.current > this.streak.longest) {
        this.streak.longest = this.streak.current;
      }
      
      // Award streak achievements
      if (this.streak.current === 7) {
        await this.addAchievement({
          achievementId: '7_day_streak',
          name: 'Weekly Warrior',
          description: 'Wrote reviews for 7 days in a row',
          badge: '📅',
          points: 50,
        });
      } else if (this.streak.current === 30) {
        await this.addAchievement({
          achievementId: '30_day_streak',
          name: 'Monthly Master',
          description: 'Wrote reviews for 30 days in a row',
          badge: '🌟',
          points: 200,
        });
      } else if (this.streak.current === 365) {
        await this.addAchievement({
          achievementId: '365_day_streak',
          name: 'Yearly Legend',
          description: 'Wrote reviews for an entire year',
          badge: '🏅',
          points: 1000,
        });
      }
    } else if (daysSinceLastReview > 1) {
      this.streak.current = 1;
    }
  }
  
  this.streak.lastReviewAt = now;
  await this.save();
};

/**
 * Redeem points for rewards
 */
userRewardSchema.methods.redeemPoints = async function(points, reward) {
  if (this.availablePoints < points) {
    throw new Error('Insufficient points');
  }
  
  this.redeemedPoints += points;
  this.availablePoints = this.totalPoints - this.redeemedPoints;
  
  this.redemptionHistory.push({
    points,
    reward,
    redeemedAt: new Date(),
    status: 'pending',
  });
  
  await this.save();
  return this.redemptionHistory[this.redemptionHistory.length - 1];
};

/**
 * Get leaderboard rank
 */
userRewardSchema.statics.getRank = async function(userId) {
  const users = await this.find()
    .sort({ totalPoints: -1 })
    .select('userId totalPoints');
  
  const rank = users.findIndex(u => u.userId.toString() === userId.toString()) + 1;
  return rank > 0 ? rank : null;
};

/**
 * Get top users by points
 */
userRewardSchema.statics.getLeaderboard = async function(limit = 10) {
  const leaderboard = await this.find()
    .sort({ totalPoints: -1 })
    .limit(limit)
    .populate('userId', 'firstName lastName profilePicture');
  
  return leaderboard.map((entry, index) => ({
    rank: index + 1,
    user: {
      id: entry.userId._id,
      name: `${entry.userId.firstName} ${entry.userId.lastName}`,
      profilePicture: entry.userId.profilePicture,
    },
    totalPoints: entry.totalPoints,
    level: entry.level,
    tier: entry.tier,
    reviewCount: entry.reviewCount,
    achievements: entry.achievements.length,
    badges: entry.badges.length,
  }));
};

/**
 * Reset weekly points (for cron job)
 */
userRewardSchema.statics.resetWeeklyPoints = async function() {
  const result = await this.updateMany(
    {},
    { weeklyPoints: 0 }
  );
  return result;
};

/**
 * Reset monthly points (for cron job)
 */
userRewardSchema.statics.resetMonthlyPoints = async function() {
  const result = await this.updateMany(
    {},
    { monthlyPoints: 0 }
  );
  return result;
};

/**
 * Pre-save middleware
 */
userRewardSchema.pre('save', function(next) {
  this.availablePoints = this.totalPoints - this.redeemedPoints;
  this.lastActiveAt = new Date();
  next();
});

/**
 * Post-save middleware
 */
userRewardSchema.post('save', function(doc) {
  console.log(`UserReward updated for user ${doc.userId}: ${doc.totalPoints} points, Level ${doc.level}, Tier ${doc.tier}`);
});

module.exports = mongoose.model('UserReward', userRewardSchema);