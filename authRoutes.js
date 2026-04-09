const express = require('express');
const { body } = require('express-validator');
const {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  updatePassword,
  logoutUser,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  updateEmail,
  deactivateAccount,
  reactivateAccount,
  getSessionInfo,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('firstName')
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 2 }).withMessage('First name must be at least 2 characters')
    .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters')
    .trim(),
  body('lastName')
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 2 }).withMessage('Last name must be at least 2 characters')
    .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters')
    .trim(),
  body('email')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('phoneNumber')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format')
    .trim(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('role')
    .optional()
    .isIn(['customer', 'restaurant_owner', 'delivery_partner']).withMessage('Invalid role selected'),
];

const loginValidation = [
  body('email')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
];

const updateProfileValidation = [
  body('firstName')
    .optional()
    .isLength({ min: 2 }).withMessage('First name must be at least 2 characters')
    .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters')
    .trim(),
  body('lastName')
    .optional()
    .isLength({ min: 2 }).withMessage('Last name must be at least 2 characters')
    .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters')
    .trim(),
  body('phoneNumber')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format')
    .trim(),
  body('profilePicture')
    .optional()
    .isURL().withMessage('Profile picture must be a valid URL'),
];

const updatePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),
];

const forgotPasswordValidation = [
  body('email')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
];

const resetPasswordValidation = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),
];

const updateEmailValidation = [
  body('newEmail')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required to verify your identity'),
];

const addressValidation = [
  body('street').optional().notEmpty().withMessage('Street is required'),
  body('city').optional().notEmpty().withMessage('City is required'),
  body('state').optional().notEmpty().withMessage('State is required'),
  body('postalCode').optional().notEmpty().withMessage('Postal code is required'),
  body('coordinates').optional().isArray().withMessage('Coordinates must be an array'),
  body('coordinates.*').optional().isNumeric().withMessage('Coordinates must be numbers'),
];

// ==================== PUBLIC ROUTES ====================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerValidation, registerUser);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginValidation, loginUser);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', refreshToken);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password', forgotPasswordValidation, forgotPassword);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password/:token', resetPasswordValidation, resetPassword);

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify user email
 * @access  Public
 */
router.get('/verify-email/:token', verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Public
 */
router.post('/resend-verification', resendVerificationEmail);

// ==================== PROTECTED ROUTES ====================

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', protect, getMe);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', protect, updateProfileValidation, updateProfile);

/**
 * @route   PUT /api/auth/password
 * @desc    Update password
 * @access  Private
 */
router.put('/password', protect, updatePasswordValidation, updatePassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate token)
 * @access  Private
 */
router.post('/logout', protect, logoutUser);

/**
 * @route   PUT /api/auth/email
 * @desc    Update email address
 * @access  Private
 */
router.put('/email', protect, updateEmailValidation, updateEmail);

/**
 * @route   DELETE /api/auth/deactivate
 * @desc    Deactivate user account
 * @access  Private
 */
router.delete('/deactivate', protect, deactivateAccount);

/**
 * @route   POST /api/auth/reactivate
 * @desc    Reactivate deactivated account
 * @access  Private
 */
router.post('/reactivate', protect, reactivateAccount);

/**
 * @route   GET /api/auth/session
 * @desc    Get current session information
 * @access  Private
 */
router.get('/session', protect, getSessionInfo);

/**
 * @route   PUT /api/auth/address
 * @desc    Update user's primary address
 * @access  Private
 */
router.put('/address', protect, addressValidation, async (req, res) => {
  const { updateAddress } = require('../controllers/authController');
  await updateAddress(req, res);
});

module.exports = router;