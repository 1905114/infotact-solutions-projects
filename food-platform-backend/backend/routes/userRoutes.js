const express = require('express');
const {
  getAllUsers,
  getUserById,
  updateUserByAdmin,
  deleteUser,
  permanentDeleteUser,
  getUserOrders,
  getUserFavorites,
  addToFavorites,
  removeFromFavorites,
  updateUserPreferences,
  addSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
  getUserStats,
  bulkUpdateUsers,
  exportUsers,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// All user routes are protected
router.use(protect);

// Admin only routes
router.get('/', authorize('admin'), getAllUsers);
router.get('/stats/overview', authorize('admin'), getUserStats);
router.post('/bulk/update', authorize('admin'), bulkUpdateUsers);
router.get('/export', authorize('admin'), exportUsers);
router.delete('/:id/permanent', authorize('admin'), permanentDeleteUser);
router.put('/:id', authorize('admin'), updateUserByAdmin);
router.delete('/:id', authorize('admin'), deleteUser);

// User specific routes (self or admin)
router.get('/:id', getUserById);
router.get('/:id/orders', getUserOrders);
router.get('/:id/favorites', getUserFavorites);
router.put('/:id/preferences', updateUserPreferences);

// Favorites management
router.post('/:id/favorites/:restaurantId', addToFavorites);
router.delete('/:id/favorites/:restaurantId', removeFromFavorites);

// Address management
router.post('/:id/addresses', addSavedAddress);
router.put('/:id/addresses/:addressId', updateSavedAddress);
router.delete('/:id/addresses/:addressId', deleteSavedAddress);

module.exports = router;