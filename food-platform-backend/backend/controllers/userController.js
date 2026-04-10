const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorMiddleware');

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/users
 * @access  Private/Admin
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password').sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: users.length,
    data: users,
  });
});

/**
 * @desc    Get single user by ID
 * @route   GET /api/users/:id
 * @access  Private/Admin or Self
 */
const getUserById = asyncHandler(async (req, res) => {
  // Check authorization: user can view their own profile or admin can view any
  if (req.user.id !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this user profile',
    });
  }
  
  const user = await User.findById(req.params.id)
    .select('-password')
    .populate('preferences.favoriteRestaurants', 'name images.logo');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }
  
  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Update user (Admin only)
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
const updateUserByAdmin = asyncHandler(async (req, res) => {
  const allowedUpdates = ['firstName', 'lastName', 'email', 'phoneNumber', 'role', 'isActive'];
  
  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });
  
  const user = await User.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  ).select('-password');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }
  
  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Delete user (Soft delete - Admin only)
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }
  
  // Soft delete
  user.isActive = false;
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'User deactivated successfully',
  });
});

/**
 * @desc    Update user preferences
 * @route   PUT /api/users/:id/preferences
 * @access  Private (Self only)
 */
const updateUserPreferences = asyncHandler(async (req, res) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }
  
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { preferences: req.body },
    { new: true, runValidators: true }
  ).select('-password');
  
  res.status(200).json({
    success: true,
    data: user.preferences,
  });
});

/**
 * @desc    Add restaurant to favorites
 * @route   POST /api/users/:id/favorites/:restaurantId
 * @access  Private (Self only)
 */
const addToFavorites = asyncHandler(async (req, res) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }
  
  const user = await User.findById(req.params.id);
  
  if (!user.preferences.favoriteRestaurants.includes(req.params.restaurantId)) {
    user.preferences.favoriteRestaurants.push(req.params.restaurantId);
    await user.save();
  }
  
  res.status(200).json({
    success: true,
    message: 'Added to favorites',
  });
});

/**
 * @desc    Remove restaurant from favorites
 * @route   DELETE /api/users/:id/favorites/:restaurantId
 * @access  Private (Self only)
 */
const removeFromFavorites = asyncHandler(async (req, res) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }
  
  const user = await User.findById(req.params.id);
  
  user.preferences.favoriteRestaurants = user.preferences.favoriteRestaurants.filter(
    id => id.toString() !== req.params.restaurantId
  );
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Removed from favorites',
  });
});

module.exports = {
  getAllUsers,
  getUserById,
  updateUserByAdmin,
  deleteUser,
  updateUserPreferences,
  addToFavorites,
  removeFromFavorites,
};