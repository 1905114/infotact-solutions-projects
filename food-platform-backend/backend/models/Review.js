const mongoose = require('mongoose');

/**
 * Review Schema - Supports gamified review system with points calculation
 */
const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true,
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
        },
        caption: {
          type: String,
          maxlength: 100,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    videos: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
        },
        thumbnail: {
          type: String,
        },
        duration: {
          type: Number,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    tags: [
      {
        type: String,
        enum: ['taste', 'service', 'ambience', 'value', 'packaging', 'delivery', 'hygiene'],
      },
    ],
    aiSuggestions: [
      {
        type: String,
      },
    ],
    pointsAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },
    pointsBreakdown: {
      basePoints: { type: Number, default: 0 },
      wordCountBonus: { type: Number, default: 0 },
      keywordBonus: { type: Number, default: 0 },
      mediaBonus: { type: Number, default: 0 },
      ratingBonus: { type: Number, default: 0 },
      helpfulBonus: { type: Number, default: 0 },
      verifiedPurchaseBonus: { type: Number, default: 0 },
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editHistory: [
      {
        content: {
          type: String,
          required: true,
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    helpfulVotes: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        votedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reportCount: {
      type: Number,
      default: 0,
    },
    reports: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reason: {
          type: String,
          required: true,
        },
        reportedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'flagged'],
      default: 'pending',
    },
    moderationNotes: {
      type: String,
      default: null,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    moderatedAt: {
      type: Date,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
reviewSchema.index({ restaurantId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, restaurantId: 1 }, { unique: true });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ pointsAwarded: -1 });
reviewSchema.index({ helpfulCount: -1 });
reviewSchema.index({ status: 1, publishedAt: -1 });
reviewSchema.index({ isFeatured: -1, helpfulCount: -1 });
reviewSchema.index({ 'tags': 1 });

/**
 * Virtual for sentiment analysis result
 */
reviewSchema.virtual('sentiment').get(function() {
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'delicious', 'love', 'best', 'wonderful', 'fantastic', 'awesome'];
  const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'disappointing', 'hate', 'worst', 'horrible', 'mediocre'];
  
  const lowerContent = this.content.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;
  
  for (const word of positiveWords) {
    if (lowerContent.includes(word)) positiveScore++;
  }
  
  for (const word of negativeWords) {
    if (lowerContent.includes(word)) negativeScore++;
  }
  
  if (positiveScore > negativeScore * 2) return 'very_positive';
  if (positiveScore > negativeScore) return 'positive';
  if (positiveScore === negativeScore) return 'neutral';
  if (negativeScore > positiveScore) return 'negative';
  return 'very_negative';
});

/**
 * Calculate total points for review
 */
reviewSchema.methods.calculateTotalPoints = function() {
  const breakdown = this.pointsBreakdown;
  this.pointsAwarded = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  return this.pointsAwarded;
};

/**
 * Add helpful vote
 */
reviewSchema.methods.addHelpfulVote = function(userId) {
  const alreadyVoted = this.helpfulVotes.some(vote => vote.userId.toString() === userId.toString());
  
  if (!alreadyVoted) {
    this.helpfulCount += 1;
    this.helpfulVotes.push({ userId, votedAt: new Date() });
    return true;
  }
  
  return false;
};

/**
 * Remove helpful vote
 */
reviewSchema.methods.removeHelpfulVote = function(userId) {
  const initialLength = this.helpfulVotes.length;
  this.helpfulVotes = this.helpfulVotes.filter(vote => vote.userId.toString() !== userId.toString());
  
  if (this.helpfulVotes.length !== initialLength) {
    this.helpfulCount = this.helpfulVotes.length;
    return true;
  }
  
  return false;
};

/**
 * Report review
 */
reviewSchema.methods.report = function(userId, reason) {
  const alreadyReported = this.reports.some(report => report.userId.toString() === userId.toString());
  
  if (!alreadyReported) {
    this.reports.push({ userId, reason, reportedAt: new Date() });
    this.reportCount = this.reports.length;
    
    // Auto-flag if multiple reports
    if (this.reportCount >= 5) {
      this.status = 'flagged';
    }
    
    return true;
  }
  
  return false;
};

/**
 * Edit review content
 */
reviewSchema.methods.editReview = function(newContent, newRating) {
  // Save current version to history
  this.editHistory.push({
    content: this.content,
    rating: this.rating,
    editedAt: new Date(),
  });
  
  // Update with new values
  if (newContent) this.content = newContent;
  if (newRating) this.rating = newRating;
  
  this.isEdited = true;
  this.updatedAt = new Date();
  
  return this;
};

/**
 * Moderate review (admin only)
 */
reviewSchema.methods.moderate = function(status, notes, moderatorId) {
  this.status = status;
  this.moderationNotes = notes;
  this.moderatedBy = moderatorId;
  this.moderatedAt = new Date();
  
  return this;
};

/**
 * Increment view count
 */
reviewSchema.methods.incrementViews = function() {
  this.viewCount += 1;
  return this;
};

/**
 * Static method to get restaurant review stats
 */
reviewSchema.statics.getRestaurantStats = async function(restaurantId) {
  const stats = await this.aggregate([
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
        totalHelpful: { $sum: '$helpfulCount' },
        totalMedia: { $sum: { $size: { $ifNull: ['$images', []] } } },
      },
    },
  ]);
  
  const result = stats[0] || {};
  return {
    averageRating: result.averageRating ? Math.round(result.averageRating * 10) / 10 : 0,
    totalReviews: result.totalReviews || 0,
    ratingDistribution: {
      5: result.rating5 || 0,
      4: result.rating4 || 0,
      3: result.rating3 || 0,
      2: result.rating2 || 0,
      1: result.rating1 || 0,
    },
    helpfulCount: result.totalHelpful || 0,
    mediaCount: result.totalMedia || 0,
  };
};

module.exports = mongoose.model('Review', reviewSchema);