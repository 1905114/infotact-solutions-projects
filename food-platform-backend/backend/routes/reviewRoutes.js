const express = require('express');
const { body, param, query } = require('express-validator');
const {
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
  getReviewLeaderboard,
  getPendingReviews,
  addReviewImage,
  deleteReviewImage,
} = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadReviewImage } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Validation rules
const createReviewValidation = [
  body('restaurantId')
    .isMongoId()
    .withMessage('Valid restaurant ID required'),
  body('orderId')
    .optional()
    .isMongoId()
    .withMessage('Valid order ID required'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('content')
    .notEmpty()
    .withMessage('Review content is required')
    .isLength({ min: 20, max: 2000 })
    .withMessage('Review must be between 20 and 2000 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .isIn(['taste', 'service', 'ambience', 'value', 'packaging', 'delivery', 'hygiene'])
    .withMessage('Invalid tag'),
];

const updateReviewValidation = [
  param('id')
    .isMongoId()
    .withMessage('Valid review ID required'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('title')
    .optional()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('content')
    .optional()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Review must be between 20 and 2000 characters'),
];

const getRestaurantReviewsValidation = [
  param('restaurantId')
    .isMongoId()
    .withMessage('Valid restaurant ID required'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  query('sortBy')
    .optional()
    .isIn(['recent', 'helpful', 'highest', 'lowest'])
    .withMessage('Invalid sort option'),
  query('tag')
    .optional()
    .isString()
    .withMessage('Invalid tag'),
];

const aiSuggestionsValidation = [
  body('restaurantId')
    .isMongoId()
    .withMessage('Valid restaurant ID required'),
  body('orderId')
    .optional()
    .isMongoId()
    .withMessage('Valid order ID required'),
  body('currentDraft')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Draft cannot exceed 500 characters'),
];

const reportReviewValidation = [
  param('id')
    .isMongoId()
    .withMessage('Valid review ID required'),
  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
];

const moderateReviewValidation = [
  param('id')
    .isMongoId()
    .withMessage('Valid review ID required'),
  body('status')
    .isIn(['approved', 'rejected', 'flagged'])
    .withMessage('Invalid status'),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
];

// ==================== PUBLIC ROUTES ====================

/**
 * @route   GET /api/reviews/restaurant/:restaurantId
 * @desc    Get reviews for a restaurant
 * @access  Public
 */
router.get('/restaurant/:restaurantId', getRestaurantReviewsValidation, getRestaurantReviews);

/**
 * @route   GET /api/reviews/:id
 * @desc    Get single review by ID
 * @access  Public
 */
router.get('/:id', param('id').isMongoId(), getReviewById);

/**
 * @route   GET /api/reviews/leaderboard
 * @desc    Get top reviewers leaderboard
 * @access  Public
 */
router.get('/leaderboard', getReviewLeaderboard);

// ==================== PROTECTED ROUTES ====================
router.use(protect);

/**
 * @route   POST /api/reviews/ai-suggestions
 * @desc    Get AI-powered keyword suggestions
 * @access  Private
 */
router.post('/ai-suggestions', aiSuggestionsValidation, getAISuggestions);

/**
 * @route   POST /api/reviews
 * @desc    Create new review
 * @access  Private
 */
router.post('/', createReviewValidation, createReview);

/**
 * @route   POST /api/reviews/:id/images
 * @desc    Add image to review
 * @access  Private
 */
router.post('/:id/images', uploadReviewImage, addReviewImage);

/**
 * @route   DELETE /api/reviews/:id/images/:imageId
 * @desc    Delete image from review
 * @access  Private
 */
router.delete('/:id/images/:imageId', deleteReviewImage);

/**
 * @route   GET /api/reviews/my-reviews
 * @desc    Get current user's reviews
 * @access  Private
 */
router.get('/my-reviews', getMyReviews);

/**
 * @route   GET /api/reviews/my-stats
 * @desc    Get user's review points and achievements
 * @access  Private
 */
router.get('/my-stats', getMyReviewStats);

/**
 * @route   PUT /api/reviews/:id
 * @desc    Update review
 * @access  Private (Owner only)
 */
router.put('/:id', updateReviewValidation, updateReview);

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete review
 * @access  Private (Owner or Admin)
 */
router.delete('/:id', param('id').isMongoId(), deleteReview);

/**
 * @route   POST /api/reviews/:id/helpful
 * @desc    Mark review as helpful
 * @access  Private
 */
router.post('/:id/helpful', param('id').isMongoId(), markHelpful);

/**
 * @route   POST /api/reviews/:id/report
 * @desc    Report inappropriate review
 * @access  Private
 */
router.post('/:id/report', reportReviewValidation, reportReview);

// ==================== ADMIN ONLY ROUTES ====================

/**
 * @route   GET /api/reviews/analytics
 * @desc    Get review analytics
 * @access  Private/Admin
 */
router.get('/analytics', authorize('admin'), getReviewAnalytics);

/**
 * @route   GET /api/reviews/pending
 * @desc    Get pending reviews for moderation
 * @access  Private/Admin
 */
router.get('/pending', authorize('admin'), getPendingReviews);

/**
 * @route   PUT /api/reviews/:id/moderate
 * @desc    Moderate review (approve/reject)
 * @access  Private/Admin
 */
router.put('/:id/moderate', authorize('admin'), moderateReviewValidation, moderateReview);

module.exports = router;